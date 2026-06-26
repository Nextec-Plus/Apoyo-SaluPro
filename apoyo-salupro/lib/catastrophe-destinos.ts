import type { CareState } from "@/lib/types/database";

export const REFERIDO_HOSPITAL = "Referido al Hospital";

export const DESTINOS = [
  "En observación en módulo móvil",
  "Dado de alta (Ambulatorio)",
  REFERIDO_HOSPITAL,
  "Trasladado a Refugio Oficial",
] as const;

export type DestinoOption = (typeof DESTINOS)[number];

export const OBSERVACION_MODULO_MOVIL = DESTINOS[0];

export const DESTINOS_ALTA_TRASLADO: readonly DestinoOption[] = DESTINOS.slice(1);

export const DESTINO_OTROS = "Otros";

export function parseDestino(notas: string | null | undefined): {
  destino: string;
  hospital: string;
} {
  const n = notas?.trim() ?? "";
  if (!n) return { destino: DESTINOS[0], hospital: "" };
  if ((DESTINOS as readonly string[]).includes(n)) {
    return { destino: n, hospital: "" };
  }
  if (n.startsWith(REFERIDO_HOSPITAL)) {
    const hospital = n
      .slice(REFERIDO_HOSPITAL.length)
      .replace(/^[\s—\-:]+/, "")
      .trim();
    return { destino: REFERIDO_HOSPITAL, hospital };
  }
  return { destino: n, hospital: "" };
}

export function formatDestino(destino: string, hospital: string): string {
  if (destino === REFERIDO_HOSPITAL) {
    const h = hospital.trim();
    return h ? `${REFERIDO_HOSPITAL} — ${h}` : REFERIDO_HOSPITAL;
  }
  return destino;
}

export function isReferidoHospital(destino: string): boolean {
  return destino === REFERIDO_HOSPITAL;
}

export function isEnObservacionModulo(notas: string | null | undefined): boolean {
  return parseDestino(notas).destino === OBSERVACION_MODULO_MOVIL;
}

export function isPacienteEnObservacion(
  notas: string | null | undefined,
  estado_destino: CareState | null | undefined,
): boolean {
  return isEnObservacionModulo(notas) && estado_destino === "Triaje";
}

export function matchesDestinoFilter(
  notas: string | null | undefined,
  filterDestino: string,
): boolean {
  if (filterDestino === OBSERVACION_MODULO_MOVIL) {
    return isEnObservacionModulo(notas);
  }
  if (filterDestino === REFERIDO_HOSPITAL) {
    const n = notas?.trim() ?? "";
    return n.startsWith(REFERIDO_HOSPITAL);
  }
  return (notas?.trim() ?? "") === filterDestino;
}

export function destinoToCareState(destino: string): CareState {
  if (destino === "Dado de alta (Ambulatorio)") return "Alta Médica";
  if (destino === REFERIDO_HOSPITAL) return "Hospitalizado";
  if (destino === "Trasladado a Refugio Oficial") return "Transferido";
  return "Triaje";
}

export function careStateToDestino(estado: CareState): DestinoOption | null {
  if (estado === "Alta Médica") return "Dado de alta (Ambulatorio)";
  if (estado === "Hospitalizado") return REFERIDO_HOSPITAL;
  if (estado === "Transferido") return "Trasladado a Refugio Oficial";
  return null;
}

export function bucketDestinoAltaTraslado(
  notas: string | null | undefined,
  estado_destino?: CareState | null,
): string {
  const { destino } = parseDestino(notas);
  if ((DESTINOS_ALTA_TRASLADO as readonly string[]).includes(destino)) {
    return destino;
  }
  if (isEnObservacionModulo(notas) && estado_destino) {
    const fromState = careStateToDestino(estado_destino);
    if (fromState) return fromState;
  }
  return DESTINO_OTROS;
}
