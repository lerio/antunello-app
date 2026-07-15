/**
 * @file Trade Republic authentication API route.
 *
 * Trade Republic uses AWS WAF protection and a complex login flow that
 * cannot be implemented with server-side fetch(). Instead, this integration
 * delegates to the pytr CLI (github.com/pytr-org/pytr), which handles
 * WAF challenges, phone+PIN+2FA login, and session management.
 *
 * Setup flow:
 *   1. User installs pytr: `uvx pytr@latest login` (one-time terminal setup)
 *   2. User clicks "Connect" in Settings → this route verifies pytr works
 *   3. On success, stores an integration_configs row
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { TradeRepublicClient } from '@/utils/trade-republic/client';
import { getErrorMessage, jsonError, requireUserId } from '@/app/api/_lib/route-utils';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { userId, unauthorizedResponse } = await requireUserId(supabase);
    if (!userId) {
      return unauthorizedResponse!;
    }

    const body = await request.json();
    const phoneNumber = (body.phoneNumber || '').trim();

    const client = new TradeRepublicClient();

    // Verify pytr is installed and authenticated.
    const isAuthed = await client.isAuthenticated();

    if (!isAuthed) {
      return NextResponse.json({
        error: 'pytr_not_authenticated',
        message:
          'Trade Republic CLI is not set up. Run this in your terminal first:\n\n' +
          '  pytr login --store_credentials\n\n' +
          'Then click Connect again.',
      }, { status: 400 });
    }

    // Store integration config.
    const accountId = phoneNumber
      ? `tr_${phoneNumber.replace(/[^0-9]/g, '')}`
      : 'tr_default';

    const settings = {
      phone_number: phoneNumber || null,
      auth_status: 'authenticated',
      bank_name: 'Trade Republic',
    };

    const { error: upsertError } = await supabase
      .from('integration_configs')
      .upsert(
        {
          user_id: userId,
          provider: 'trade_republic',
          account_id: accountId,
          settings,
        },
        { onConflict: 'user_id, provider, account_id' },
      );

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Trade Republic auth error:', error);
    return jsonError(getErrorMessage(error), 500);
  }
}
