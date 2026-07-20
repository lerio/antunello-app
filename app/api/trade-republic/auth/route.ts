/**
 * Trade Republic authentication — 2-step web login via Render service.
 *
 * Step 1: { step: 1, phoneNumber, pin }
 *   → initiates web login via Render, push notification sent to phone
 *
 * Step 2: { step: 2, phoneNumber, pin, processId, code }
 *   → completes login, stores session cookies in integration_configs
 *
 * Re-auth (preserves fund mappings, bulk-fetch toggle, etc.):
 *   reauth_initiate: { step: 'reauth_initiate', accountId }
 *     → reads stored phone + PIN, initiates device reset
 *   reauth_complete: { step: 'reauth_complete', accountId, processId, code }
 *     → completes login, PATCHes only session_cookies + auth_status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { TradeRepublicClient } from '@/utils/trade-republic/client';
import { getErrorMessage, jsonError, requireUserId } from '@/app/api/_lib/route-utils';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { userId, unauthorizedResponse } = await requireUserId(supabase);
    if (!userId) return unauthorizedResponse!;

    const body = await request.json();
    const step = body.step;

    if (step === 1) {
      const phone = (body.phoneNumber || '').trim();
      const pin = (body.pin || '').trim();
      if (!phone || !pin) {
        return NextResponse.json({ error: 'phoneNumber and pin required' }, { status: 400 });
      }

      const { processId, countdownSeconds } =
        await TradeRepublicClient.initiateDeviceReset(phone, pin);

      return NextResponse.json({ processId, countdownSeconds });
    }

    // ---- Re-auth: initiate (uses stored phone + PIN, no user input) ----
    if (step === 'reauth_initiate') {
      const accountId = (body.accountId || '').trim();
      if (!accountId) {
        return NextResponse.json({ error: 'accountId required' }, { status: 400 });
      }

      // Read stored credentials from the existing integration config.
      const { data: config, error: configError } = await supabase
        .from('integration_configs')
        .select('settings')
        .eq('user_id', userId)
        .eq('provider', 'trade_republic')
        .eq('account_id', accountId)
        .single();

      if (configError || !config) {
        return NextResponse.json(
          { error: 'Integration config not found. Please disconnect and re-connect.' },
          { status: 404 },
        );
      }

      const settings = (config.settings || {}) as Record<string, unknown>;
      const phone = (settings.phone_number as string) || '';
      const pin = (settings.pin as string) || '';

      if (!phone || !pin) {
        return NextResponse.json(
          { error: 'Stored credentials missing. Please disconnect and re-connect.' },
          { status: 400 },
        );
      }

      const { processId, countdownSeconds } =
        await TradeRepublicClient.initiateDeviceReset(phone, pin);

      return NextResponse.json({ processId, countdownSeconds });
    }

    if (step === 2) {
      const phone = (body.phoneNumber || '').trim();
      const pin = (body.pin || '').trim();
      const processId = (body.processId || '').trim();
      const code = (body.code || '').trim();

      if (!phone || !pin || !processId || !code) {
        return NextResponse.json(
          { error: 'phoneNumber, pin, processId, and code required' },
          { status: 400 },
        );
      }

      const { cookies } = await TradeRepublicClient.completeDeviceReset(
        phone, pin, processId, code,
      );

      const accountId = `tr_${phone.replace(/[^0-9]/g, '')}`;

      const { error: upsertError } = await supabase
        .from('integration_configs')
        .upsert(
          {
            user_id: userId,
            provider: 'trade_republic',
            account_id: accountId,
            settings: {
              phone_number: phone,
              pin,
              session_cookies: cookies,
              auth_status: 'authenticated',
              bank_name: 'Trade Republic',
            },
          },
          { onConflict: 'user_id, provider, account_id' },
        );

      if (upsertError) throw upsertError;

      return NextResponse.json({ success: true });
    }

    // ---- Re-auth: complete (PATCH only session fields, preserve everything else) ----
    if (step === 'reauth_complete') {
      const accountId = (body.accountId || '').trim();
      const processId = (body.processId || '').trim();
      const code = (body.code || '').trim();

      if (!accountId || !processId || !code) {
        return NextResponse.json(
          { error: 'accountId, processId, and code required' },
          { status: 400 },
        );
      }

      // Read the existing row to get stored credentials and current settings.
      const { data: config, error: configError } = await supabase
        .from('integration_configs')
        .select('id, settings')
        .eq('user_id', userId)
        .eq('provider', 'trade_republic')
        .eq('account_id', accountId)
        .single();

      if (configError || !config) {
        return NextResponse.json(
          { error: 'Integration config not found.' },
          { status: 404 },
        );
      }

      const existingSettings = (config.settings || {}) as Record<string, unknown>;
      const phone = (existingSettings.phone_number as string) || '';
      const pin = (existingSettings.pin as string) || '';

      if (!phone || !pin) {
        return NextResponse.json(
          { error: 'Stored credentials missing. Please disconnect and re-connect.' },
          { status: 400 },
        );
      }

      const { cookies } = await TradeRepublicClient.completeDeviceReset(
        phone, pin, processId, code,
      );

      // PATCH only session_cookies and auth_status — preserve fund_category_id,
      // bulk_fetch_enabled, bank_name, and all other settings.
      const { error: updateError } = await supabase
        .from('integration_configs')
        .update({
          settings: {
            ...existingSettings,
            session_cookies: cookies,
            auth_status: 'authenticated',
          },
          last_sync_at: null, // force a fresh sync on next fetch
        })
        .eq('id', config.id);

      if (updateError) throw updateError;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid step. Use 1, 2, reauth_initiate, or reauth_complete.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Trade Republic auth error:', error);
    return jsonError(getErrorMessage(error), 500);
  }
}
