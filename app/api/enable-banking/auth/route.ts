import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import * as jose from 'jose';

export async function GET(request: NextRequest) {
    try {
        // 1. Verify User is Authenticated
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.redirect(new URL('/sign-in', request.url));
        }

        const appId = process.env.ENABLE_BANKING_APP_ID;
        const appKey = process.env.ENABLE_BANKING_PRIVATE_KEY;
        const kid = process.env.ENABLE_BANKING_KID || appId;

        if (!appId || !appKey) {
            return NextResponse.json({ error: 'Missing Enable Banking Configuration' }, { status: 500 });
        }

        // 2. Generate Token
        const alg = 'RS256';
        const privateKey = await jose.importPKCS8(appKey, alg);
        const token = await new jose.SignJWT({})
            .setProtectedHeader({ alg, kid: kid! })
            .setIssuedAt()
            .setExpirationTime('5m')
            .setIssuer(appId)
            .setAudience('api.enablebanking.com')
            .sign(privateKey);

        // 3. Determine Callback URL
        let baseUrl = 'http://localhost:3000';
        if (process.env.VERCEL_URL) {
            baseUrl = `https://${process.env.VERCEL_URL}`;
        }
        if (process.env.NEXT_PUBLIC_APP_URL) {
            baseUrl = process.env.NEXT_PUBLIC_APP_URL;
        }

        const callbackUrl = `${baseUrl}/api/enable-banking/callback`;

        // 4. Find ASPSP
        const searchParams = request.nextUrl.searchParams;
        const targetBank = searchParams.get('bank') || 'Bunq';
        const targetCountry = searchParams.get('country') || 'NL';

        // Fetch ASPSPs to get exact name
        const aspspRes = await fetch(`https://api.enablebanking.com/aspsps?country=${targetCountry}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const aspspsData = await aspspRes.json();
        if (!aspspRes.ok) throw new Error('Failed to fetch ASPSPs');

        const aspsps = aspspsData.aspsps || [];
        const bankAspsp = aspsps.find((a: any) => a.name.toLowerCase().includes(targetBank.toLowerCase()));

        if (!bankAspsp) {
            return NextResponse.json({
                error: `Bank '${targetBank}' not found in '${targetCountry}'.`,
                available_banks: aspsps.map((a: any) => a.name)
            }, { status: 404 });
        }

        // 5. Prepare Auth Request
        const authBody = {
            access: {
                valid_until: new Date(Date.now() + 89 * 24 * 60 * 60 * 1000).toISOString(),
                transactions: true
            },
            aspsp: {
                name: bankAspsp.name,
                country: targetCountry
            },
            // Store bank name in state to retrieve it in callback for metadata
            state: `${user.id}:${bankAspsp.name}`,
            redirect_url: callbackUrl
        };

        const authRes = await fetch('https://api.enablebanking.com/auth', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(authBody)
        });

        const authData = await authRes.json();

        if (!authRes.ok) {
            return NextResponse.json({ error: 'Auth Init Failed in Enable Banking', details: authData }, { status: authRes.status });
        }

        // 6. Redirect User
        return NextResponse.redirect(authData.url);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
