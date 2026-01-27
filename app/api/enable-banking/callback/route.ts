import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import * as jose from 'jose';

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
            // Upsert integration config
            const { error: dbError } = await supabase
                .from('integration_configs')
                .upsert({
                    user_id: user.id,
                    provider: 'enable_banking',
                    account_id: acc.uid,
                    settings: {
                        session_id: sessionData.session_id,
                        iban: acc.account_id?.iban,
                        currency: acc.account_id?.currency,
                        bank_name: stateBankName // Save the bank name we carried over
                    },
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id, provider, account_id'
                });

            if (dbError) {
                console.error('DB Insert Error:', dbError);
                throw dbError;
            }
        }

        // 4. Redirect Success
        return NextResponse.redirect(settingsUrl);

    } catch (e: any) {
        console.error('Callback Exception:', e);
        return NextResponse.redirect(errorUrl);
    }
}
