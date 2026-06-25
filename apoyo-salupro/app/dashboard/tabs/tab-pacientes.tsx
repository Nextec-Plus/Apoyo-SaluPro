"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { generoDbToUi, getClientOrganizationId } from "@/lib/config";
import type { CatastropheVictim, CatastropheVictimInfo } from "@/lib/types/database";

type VictimRow = CatastropheVictim & {
  catastrophe_victim_info: CatastropheVictimInfo | CatastropheVictimInfo[] | null;
};

function triageBadge(category: string | null | undefined) {
  if (category === "Verde") return "bg-green-100 text-triage-green border-triage-green/30";
  if (category === "Amarillo") return "bg-amber-100 text-triage-yellow border-triage-yellow/30";
  if (category === "Rojo") return "bg-red-100 text-crisis border-crisis/30";
  return "bg-gray-100 text-gray-500 border-gray-200";
}

function getInfo(row: VictimRow): CatastropheVictimInfo | null {
  const info = row.catastrophe_victim_info;
  if (!info) return null;
  return Array.isArray(info) ? info[0] ?? null : info;
}

export function TabPacientes({ onOpenPatient }: { onOpenPatient: (id: string) => void }) {
  const toast = useToast();
  const [patients, setPatients] = useState<VictimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadPatients = useCallback(async () => {
    setLoading(true);
    const orgId = getClientOrganizationId();
    const params = new URLSearchParams({ organization_id: orgId });
    if (search.trim()) params.set("search", search.trim());

    try {
      const res = await fetch(`/api/catastrophe/victims?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al cargar pacientes");
      setPatients(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar pacientes");
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    const timer = setTimeout(loadPatients, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadPatients, search]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border">
      <div className="border-b border-border p-6 pb-4">
        <h2 className="text-lg font-bold text-gray-800">Pacientes Registrados</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Lista de damnificados ingresados en la clínica móvil. Haz clic para ver la ficha completa.
        </p>
        <div className="mt-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="w-full sm:max-w-sm text-sm bg-muted border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-12 text-center">Cargando pacientes…</p>
      ) : patients.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">
          {search ? "Sin resultados para la búsqueda" : "Aún no hay pacientes registrados"}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {patients.map((p) => {
            const info = getInfo(p);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onOpenPatient(p.id)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/60 transition-colors group text-left"
                >
                  <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                    {p.registration_number?.replace("V-", "") ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-primary transition-colors">
                      {p.nombre_completo}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {[p.cedula, p.edad ? `${p.edad} años` : null, generoDbToUi(p.genero)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {info?.motivo_principal_consulta && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {info.motivo_principal_consulta}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {info?.triage_category && (
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${triageBadge(info.triage_category)}`}
                      >
                        {info.triage_category}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 font-mono">
                      {p.registration_number}
                    </span>
                  </div>
                  <span className="text-gray-300 group-hover:text-primary transition-colors">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
