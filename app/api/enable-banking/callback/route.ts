/**
 * @file Handle the OAuth callback from Enable Banking after a user has
 * granted consent. Exchanges the authorisation code for a session and
 * persists the connected accounts as `integration_configs` rows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import * as jose from 'jose';

/**
 * Generate a signed JWT for the Enable Banking API.
 *
 * @param appId - The application identifier.
 * @param appKey - The PEM-encoded PKCS#8 private key.
 * @param kid   - The key ID (falls back to `appId`).
 * @returns A signed JWT string valid for 5 minutes.
 */
async function generateToken(appId: string, appKey: string, kid: string) {
    const alg = 'RS256';
    const privateKey = await jose.importPKCS8(appKey, alg);
    return new jose.SignJWT({})
        .setProtectedHeader({ alg, kid })
        .setIssuedAt()
        .setExpirationTime('5m')
        .setIssuer(appId)
        .setAudience('api.enablebanking.com')
        .sign(privateKey);
}

/**
 * Handle the OAuth callback from Enable Banking.
 *
 * Expected query parameters:
 * - `code`  – The authorisation code from Enable Banking.
 * - `state` – Contains the user ID and bank name (`userId:BankName`).
 * - `error` – An error string if the user denied consent.
 *
 * @param request - The incoming callback request with query parameters.
 * @returns A 302 redirect to the settings page (success or error).
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state') || '';

    // Parse state: "userId:Bank Name"
    const [stateUserId, stateBankName] = state.includes(':') ? state.split(':') : [state, undefined];

    // Determine Redirect Target (Settings Page)
    let baseUrl = 'http://localhost:3000';
    if (process.env.VERCEL_URL) baseUrl = `https://${process.env.VERCEL_URL}`;
    if (process.env.NEXT_PUBLIC_APP_URL) baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    const settingsUrl = `${baseUrl}/protected/settings?integration=success`;
    const errorUrl = `${baseUrl}/protected/settings?integration=error`;

    if (error || !code) {
        console.error('Callback Error:', error);
        return NextResponse.redirect(errorUrl);
    }

    try {
        // 1. Authenticate User (to ensure we attach config to correct user)
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.redirect(new URL('/sign-in', request.url));
        }

        const appId = process.env.ENABLE_BANKING_APP_ID;
        const appKey = process.env.ENABLE_BANKING_PRIVATE_KEY;
        const kid = process.env.ENABLE_BANKING_KID || appId;

        if (!appId || !appKey) throw new Error("Missing config");

        const token = await generateToken(appId, appKey, kid!);

        // 2. Exchange code for session
        const sessionRes = await fetch('https://api.enablebanking.com/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });

        const sessionData = await sessionRes.json();

        if (!sessionRes.ok) {
            console.error('Session Exchange Failed:', sessionData);
            return NextResponse.redirect(errorUrl);
        }

        // 3. Save to Database
        const accounts = sessionData.accounts || [];

        for (const acc of accounts) {
            // Try to find an existing config for this account.
            // Priority: 1) exact account_id match, 2) identification_hash overlap,
            // 3) IBAN match. This handles re-authorisation where the account UID
            // changes but the underlying bank account is the same.
            let existingConfig: { id: string; settings: any } | null = null;

            // 1) Exact match by account_id (UID)
            const { data: byUid } = await supabase
                .from('integration_configs')
                .select('id, settings')
                .eq('user_id', user.id)
                .eq('provider', 'enable_banking')
                .eq('account_id', acc.uid)
                .maybeSingle();

            if (byUid) {
                existingConfig = byUid;
            }

            // 2) Match by identification_hashes overlap
            if (!existingConfig && acc.identification_hashes?.length) {
                const { data: allConfigs } = await supabase
                    .from('integration_configs')
                    .select('id, settings')
                    .eq('user_id', user.id)
                    .eq('provider', 'enable_banking');

                const matchingConfig = allConfigs?.find((cfg) => {
                    const storedHashes: string[] = (cfg.settings as any)?.identification_hashes || [];
                    return storedHashes.some((h) => acc.identification_hashes!.includes(h));
                });

                if (matchingConfig) {
                    existingConfig = matchingConfig;
                }
            }

            // 3) Match by IBAN
            if (!existingConfig && acc.account_id?.iban) {
                const { data: allConfigs } = await supabase
                    .from('integration_configs')
                    .select('id, settings')
                    .eq('user_id', user.id)
                    .eq('provider', 'enable_banking');

                const matchingConfig = allConfigs?.find((cfg) => {
                    return (cfg.settings as any)?.iban === acc.account_id?.iban;
                });

                if (matchingConfig) {
                    existingConfig = matchingConfig;
                }
            }

            const mergedSettings = {
                ...(existingConfig?.settings as any || {}),
                session_id: sessionData.session_id,
                iban: acc.account_id?.iban,
                currency: acc.account_id?.currency,
                bank_name: stateBankName,
                identification_hashes: acc.identification_hashes || [],
            };

            if (existingConfig && !byUid) {
                // Matched by hash or IBAN — the account UID changed after
                // re-authorisation. Update the existing row in place so we
                // preserve last_sync_at and any other state.
                const { error: updateError } = await supabase
                    .from('integration_configs')
                    .update({
                        account_id: acc.uid,
                        settings: mergedSettings,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingConfig.id);

                if (updateError) {
                    console.error('DB Update Error:', updateError);
                    throw updateError;
                }
            } else {
                // New account, or matched by exact UID — safe to upsert.
                const { error: dbError } = await supabase
                    .from('integration_configs')
                    .upsert({
                        user_id: user.id,
                        provider: 'enable_banking',
                        account_id: acc.uid,
                        settings: mergedSettings,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'user_id, provider, account_id'
                    });

                if (dbError) {
                    console.error('DB Insert Error:', dbError);
                    throw dbError;
                }
            }
        }

        // 4. Redirect Success
        return NextResponse.redirect(settingsUrl);

    } catch (e: any) {
        console.error('Callback Exception:', e);
        return NextResponse.redirect(errorUrl);
    }
}
