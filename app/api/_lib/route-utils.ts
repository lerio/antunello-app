/**
 * @file Shared utilities for API route handlers. Provides helpers to
 * return consistent JSON error responses, extract human-readable error
 * messages, and require an authenticated user from a Supabase client.
 */

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

/**
 * Return a JSON error response with the given status code.
 *
 * @param message - The error message to include in the response body.
 * @param status  - The HTTP status code (default `500`).
 * @returns A {@link NextResponse} with `{ error: message }` as the body.
 */
export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Shorthand for a 401 Unauthorized JSON response.
 *
 * @returns A {@link NextResponse} with status 401.
 */
export function jsonUnauthorized() {
  return jsonError('Unauthorized', 401);
}

/**
 * Extract a human-readable error message from an unknown error value.
 *
 * @param error    - The error value (instance of `Error`, string, or other).
 * @param fallback - The fallback message if the error cannot be parsed
 *                   (default `'Unknown error'`).
 * @returns A non-empty error string.
 */
export function getErrorMessage(error: unknown, fallback = 'Unknown error') {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return fallback;
}

/**
 * Resolve the authenticated user ID from a Supabase client and return a
 * pre-built unauthorized response if the user is not found.
 *
 * @param supabase - A Supabase-like client with an `auth.getUser()` method.
 * @returns An object containing either the `userId` string and
 *          `unauthorizedResponse: null`, or `userId: null` and a
 *          `NextResponse` that can be returned directly from the route.
 */
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
