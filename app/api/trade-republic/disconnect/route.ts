/**
 * @file Disconnect a Trade Republic integration by removing the corresponding
 * integration_configs row(s).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getErrorMessage, jsonError, requireUserId } from '@/app/api/_lib/route-utils';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { userId, unauthorizedResponse } = await requireUserId(supabase);
    if (!userId) {
      return unauthorizedResponse!;
    }

    const { account_id } = await request.json();

    if (!account_id) {
      return NextResponse.json(
        { error: 'Must provide account_id' },
        { status: 400 },
      );
    }

    const { data: configs, error: fetchError } = await supabase
      .from('integration_configs')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'trade_republic')
      .eq('account_id', account_id);

    if (fetchError) {
      throw fetchError;
    }

    if (!configs || configs.length === 0) {
      return NextResponse.json(
        { error: 'Trade Republic integration config not found' },
        { status: 404 },
      );
    }

    const { error: deleteError } = await supabase
      .from('integration_configs')
      .delete()
      .eq('id', configs[0].id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return jsonError(getErrorMessage(error), 500);
  }
}
