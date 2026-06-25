import type { FoundMatchResult } from "@/lib/missing-person-match";
import { FOUND_MATCHES_UPDATED_EVENT } from "@/lib/events";

export function formatFoundMatchesNotice(matches: FoundMatchResult[]): string | null {
  if (!matches.length) return null;
  const names = matches
    .map((m) => `${m.missing_person_nombre} ${m.missing_person_apellido}`)
    .join(", ");
  const nuevo = matches.some((m) => m.created);
  return nuevo
    ? `¡Coincidencia con desaparecido: ${names}! Agregado a Encontrados.`
    : `Coincidencia confirmada con: ${names}.`;
}

export function notifyFoundMatches(matches: FoundMatchResult[]) {
  if (!matches.length) return;
  window.dispatchEvent(new CustomEvent(FOUND_MATCHES_UPDATED_EVENT));
}
