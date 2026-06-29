"use client";

import { useCallback, useEffect, useState } from "react";
import { getClientOrganizationId } from "@/lib/config";
import type { MissingPersonMatchType } from "@/lib/types/database";
import { FOUND_MATCHES_UPDATED_EVENT } from "@/lib/events";
import { isReferidoHospitalNotas, parseDestino } from "@/lib/catastrophe-destinos";

type FoundRow = {
  id: string;
  match_type: MissingPersonMatchType;
  created_at: string;
  missing_persons: {
    id: string;
    nombre: string;
    apellido: string;
    cedula: string | null;
    estado: string;
    contacto_nombre: string;
    contacto_apellido: string;
    contacto_telefono_nacional: string | null;
  } | null;
  catastrophe_victims: {
    id: string;
    nombre_completo: string;
    cedula: string | null;
    registration_number: string;
    ubicacion_actual_refugio: string | null;
    notas: string | null;
  } | null;
};

const MATCH_LABEL: Record<MissingPersonMatchType, string> = {
  cedula: "Cédula",
  nombre: "Nombre",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TabEncontrados({
  onOpenPatient,
}: {
  onOpenPatient: (id: string) => void;
}) {
  const orgId = getClientOrganizationId();
  const [rows, setRows] = useState<FoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/missing-persons/found?organization_id=${encodeURIComponent(orgId)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al cargar encontrados");
      setRows(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUpdate = () => load();
    window.addEventListener(FOUND_MATCHES_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(FOUND_MATCHES_UPDATED_EVENT, onUpdate);
  }, [load]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      <div className="border-b border-border pb-3 mb-6">
        <h2 className="text-lg font-bold text-gray-800">Personas Encontradas</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Coincidencias automáticas entre fichas médicas y reportes de desaparecidos.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-12 text-center">Cargando coincidencias…</p>
      ) : error ? (
        <p className="text-sm text-crisis py-12 text-center">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">
          Aún no hay coincidencias registradas. Se detectan al guardar una ficha médica con cédula o nombre igual a un desaparecido activo.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-border">
                <th className="px-3 py-2">Desaparecido</th>
                <th className="px-3 py-2">Ficha médica</th>
                <th className="px-3 py-2">Coincidencia</th>
                <th className="px-3 py-2">Ubicación</th>
                <th className="px-3 py-2">Contacto</th>
                <th className="px-3 py-2">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const person = row.missing_persons;
                const victim = row.catastrophe_victims;
                if (!person || !victim) return null;

                return (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="px-3 py-3 align-top">
                      <p className="font-semibold text-gray-800">
                        {person.nombre} {person.apellido}
                      </p>
                      {person.cedula && (
                        <p className="text-xs text-gray-500 mt-0.5">{person.cedula}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <button
                        type="button"
                        onClick={() => onOpenPatient(victim.id)}
                        className="text-left font-semibold text-primary hover:underline"
                      >
                        {victim.nombre_completo}
                      </button>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[victim.registration_number, victim.cedula].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="inline-flex rounded-full bg-primary-light text-primary-dark text-[10px] font-semibold px-2 py-0.5">
                        {MATCH_LABEL[row.match_type]}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top text-xs max-w-[160px]">
                      {isReferidoHospitalNotas(victim.notas) ? (
                        <span className="inline-flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 text-[10px] whitespace-nowrap">
                            🏥 Hospital
                          </span>
                          {parseDestino(victim.notas).hospital && (
                            <span className="text-gray-700 leading-tight">
                              {parseDestino(victim.notas).hospital}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-600">
                          {victim.ubicacion_actual_refugio ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-gray-600">
                      <p>{person.contacto_nombre} {person.contacto_apellido}</p>
                      {person.contacto_telefono_nacional && (
                        <p className="text-gray-500 mt-0.5">{person.contacto_telefono_nacional}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
