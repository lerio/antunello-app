/**
 * @file API route for deleting a single pending transaction by ID.
 * Pending transactions are imported bank transactions that have not yet
 * been accepted into the main `transactions` table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Delete a pending transaction by ID.
 *
 * @param request - The incoming DELETE request.
 * @param params  - Route parameters containing `id` (the pending
 *   transaction UUID).
 * @returns A JSON response indicating success, or an error with status 500.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } // Params is a Promise in Next.js 15+ (and 16)
) {
    const { id } = await params;
    const supabase = await createClient();

    // Soft-delete: mark as 'added' instead of physically deleting.
    // This preserves the external_id so future syncs can deduplicate.
    const { error } = await supabase
        .from('pending_transactions')
        .update({ status: 'added' })
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
