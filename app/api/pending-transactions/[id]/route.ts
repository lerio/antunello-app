import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } // Params is a Promise in Next.js 15+ (and 16)
) {
    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
        .from('pending_transactions')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
