import { createClient } from "@/lib/supabase/server";

/** Requiere sesión activa (rutas de reportes solo para personal autenticado). */
export async function requireReportAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  return null;
}
