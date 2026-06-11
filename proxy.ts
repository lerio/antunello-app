/**
 * @file Next.js middleware entry point. Delegates session management to
 * the Supabase middleware (`updateSession`) and defines the route matcher
 * pattern used to decide which paths trigger the middleware.
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

/**
 * Middleware handler invoked for matching routes.
 * Refreshes the Supabase auth session and redirects unauthenticated users
 * as needed.
 *
 * @param request - The incoming HTTP request.
 * @returns The response after session processing.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
