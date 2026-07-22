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

export const maxDuration = 60; // Render free tier cold starts can take 30+ s

interface AuthRequestBody {
  step: 1 | 2 | 'reauth_initiate' | 'reauth_complete';
  phoneNumber?: string;
  pin?: string;
  processId?: string;
  code?: string;
  accountId?: string;
}

interface StoredCredentials {
  phone: string;
  pin: string;
  existingSettings: Record<string, unknown>;
  configId: string;
}

/**
 * Retrieves Trade Republic phone and PIN from existing integration settings.
 */
async function getStoredCredentials(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  accountId: string
): Promise<StoredCredentials> {
  const { data: config, error: configError } = await supabase
    .from('integration_configs')
    .select('id, settings')
    .eq('user_id', userId)
    .eq('provider', 'trade_republic')
    .eq('account_id', accountId)
    .single();

  if (configError || !config) {
    throw new Error('Integration config not found. Please disconnect and re-connect.');
  }

  const existingSettings = (config.settings || {}) as Record<string, unknown>;
  const phone = (existingSettings.phone_number as string) || '';
  const pin = (existingSettings.pin as string) || '';

  if (!phone || !pin) {
    throw new Error('Stored credentials missing. Please disconnect and re-connect.');
  }

  return { phone, pin, existingSettings, configId: config.id };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { userId, unauthorizedResponse } = await requireUserId(supabase);
    if (!userId) return unauthorizedResponse!;

    const body = (await request.json()) as AuthRequestBody;
    const { step } = body;

    // ---- Step 1: Initiate auth or re-auth ----
    if (step === 1 || step === 'reauth_initiate') {
      let phone = '';
      let pin = '';

      if (step === 1) {
        phone = (body.phoneNumber || '').trim();
        pin = (body.pin || '').trim();
        if (!phone || !pin) {
          return NextResponse.json({ error: 'phoneNumber and pin required' }, { status: 400 });
        }
      } else {
        const accountId = (body.accountId || '').trim();
        if (!accountId) {
          return NextResponse.json({ error: 'accountId required' }, { status: 400 });
        }
        try {
          const creds = await getStoredCredentials(supabase, userId, accountId);
          phone = creds.phone;
          pin = creds.pin;
        } catch (e: any) {
          const status = e.message.includes('not found') ? 404 : 400;
          return NextResponse.json({ error: e.message }, { status });
        }
      }

      const { processId, countdownSeconds } =
        await TradeRepublicClient.initiateDeviceReset(phone, pin);

      return NextResponse.json({ processId, countdownSeconds });
    }

    // ---- Step 2: Complete auth or re-auth ----
    if (step === 2 || step === 'reauth_complete') {
      let phone = '';
      let pin = '';
      let existingSettings: Record<string, unknown> = {};
      let configId = '';

      const processId = (body.processId || '').trim();
      const code = (body.code || '').trim();

      if (!processId || !code) {
        return NextResponse.json({ error: 'processId and code required' }, { status: 400 });
      }

      if (step === 2) {
        phone = (body.phoneNumber || '').trim();
        pin = (body.pin || '').trim();
        if (!phone || !pin) {
          return NextResponse.json({ error: 'phoneNumber and pin required' }, { status: 400 });
        }
      } else {
        const accountId = (body.accountId || '').trim();
        if (!accountId) {
          return NextResponse.json({ error: 'accountId required' }, { status: 400 });
        }
        try {
          const creds = await getStoredCredentials(supabase, userId, accountId);
          phone = creds.phone;
          pin = creds.pin;
          existingSettings = creds.existingSettings;
          configId = creds.configId;
        } catch (e: any) {
          const status = e.message.includes('not found') ? 404 : 400;
          return NextResponse.json({ error: e.message }, { status });
        }
      }

      const { cookies } = await TradeRepublicClient.completeDeviceReset(
        phone, pin, processId, code,
      );

      if (step === 2) {
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
      } else {
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
          .eq('id', configId);

        if (updateError) throw updateError;
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid step. Use 1, 2, reauth_initiate, or reauth_complete.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Trade Republic auth error:', error);
    return jsonError(getErrorMessage(error), 500);
  }
}
