"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Credenciales inválidas. Intente nuevamente."
          : authError.message,
      );
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-[30rem] bg-white rounded-xl shadow-lg border border-border overflow-hidden">

        {/* Banner crisis */}
        <div className="bg-crisis px-5 py-2.5 flex items-center gap-2.5">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
          <p className="text-white text-xs font-semibold tracking-wide uppercase">
            Crisis activa · Terremoto La Guaira · 25 Jun 2026
          </p>
        </div>

        <div className="px-8 pt-8 pb-6">
          {/* Logo */}
          <div className="flex justify-center mb-1">
            <Image
              src="/logo_salupro_light.png"
              alt="SaluPro"
              width={180}
              height={54}
              priority
              className="h-12 w-auto"
            />
          </div>
          <p className="text-center text-xs font-semibold text-primary tracking-widest uppercase mb-6">
            Apoyo SaluPro
          </p>

          <hr className="border-border mb-6" />

          <h1 className="text-2xl font-semibold text-center text-gray-900 mb-6">
            Iniciar sesión
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="operador@apoyosalupro.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-3 text-sm text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary
                  transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-3 text-sm text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary
                  transition-colors"
              />
              <div className="text-right pt-1">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-crisis bg-crisis-light border border-crisis/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-lg
                transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm tracking-wide"
            >
              {loading ? "Verificando..." : "Entrar"}
            </button>
          </form>
        </div>

        <div className="px-8 py-4 border-t border-border text-center">
          <Link href="/" className="text-xs text-primary font-medium hover:underline">
            ← Volver al portal público
          </Link>
          <p className="text-[11px] text-gray-400 mt-1">
            Sistema local de emergencias · Estado La Guaira
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
