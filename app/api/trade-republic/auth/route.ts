/**
 * Trade Republic authentication — 2-step web login via Render service.
 *
 * Step 1: { step: 1, phoneNumber, pin }
 *   → initiates web login via Render, push notification sent to phone
 *
 * Step 2: { step: 2, phoneNumber, pin, processId, code }
 *   → completes login, stores session cookies in integration_configs
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

    return NextResponse.json({ error: 'Invalid step. Use 1 or 2.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Trade Republic auth error:', error);
    return jsonError(getErrorMessage(error), 500);
  }
}
