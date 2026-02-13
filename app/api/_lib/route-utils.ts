import { NextResponse } from 'next/server';

type AuthUser = { id: string } | null;

type SupabaseAuthLike = {
  auth: {
    getUser: () => Promise<{
      data: { user: AuthUser };
      error: unknown;
    }>;
  };
};

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonUnauthorized() {
  return jsonError('Unauthorized', 401);
}

export function getErrorMessage(error: unknown, fallback = 'Unknown error') {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return fallback;
}

export async function requireUserId(supabase: SupabaseAuthLike) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { userId: null as string | null, unauthorizedResponse: jsonUnauthorized() };
  }

  return { userId: user.id, unauthorizedResponse: null as NextResponse<unknown> | null };
}
