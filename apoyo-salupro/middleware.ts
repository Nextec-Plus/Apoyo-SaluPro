import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

/**
 * Refresca la sesión de Supabase en cada request y protege /dashboard.
 * Patrón SSR recomendado: el middleware reescribe las cookies de auth para que
 * Server Components y Route Handlers vean siempre un token válido.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: no insertar lógica entre createServerClient y getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/inventario") ||
    pathname.startsWith("/api/inventory") ||
    pathname.startsWith("/api/reportes");

  // Rutas protegidas: requieren sesión.
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Control de acceso por rol: el usuario de inventario solo ve /inventario.
  // El rol se guarda tanto en app_metadata como en user_metadata al crear el
  // usuario. Si intenta entrar al dashboard clínico se le redirige.
  if (user) {
    const role =
      (user.app_metadata?.role as string | undefined) ??
      (user.user_metadata?.role as string | undefined);

    if (
      role === "inventory" &&
      (pathname.startsWith("/dashboard") || pathname.startsWith("/api/reportes"))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/inventario";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inventario/:path*",
    "/api/inventory/:path*",
    "/api/reportes/:path*",
  ],
};
