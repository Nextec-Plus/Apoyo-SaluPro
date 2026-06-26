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

const REFERIDO_HOSPITAL_RE = /^referido\s+(?:al\s+|a\s+)?hospital/i;

function trimNotas(notas: string | null | undefined): string {
  return notas?.trim() ?? "";
}

function findExactDestino(notas: string): DestinoOption | null {
  const lower = notas.toLowerCase();
  return (DESTINOS as readonly DestinoOption[]).find((d) => d.toLowerCase() === lower) ?? null;
}

export function isReferidoHospitalNotas(notas: string | null | undefined): boolean {
  return REFERIDO_HOSPITAL_RE.test(trimNotas(notas));
}

export function parseDestino(notas: string | null | undefined): {
  destino: string;
  hospital: string;
} {
  const n = trimNotas(notas);
  if (!n) return { destino: DESTINOS[0], hospital: "" };

  const exactDestino = findExactDestino(n);
  if (exactDestino) return { destino: exactDestino, hospital: "" };

  const hospitalMatch = n.match(REFERIDO_HOSPITAL_RE);
  if (hospitalMatch) {
    const hospital = n
      .slice(hospitalMatch[0].length)
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

export function resolveDestinoPaciente(
  notas: string | null | undefined,
  estado_destino: CareState | null | undefined,
): string {
  if (isReferidoHospitalNotas(notas) || estado_destino === "Hospitalizado") {
    return REFERIDO_HOSPITAL;
  }

  const { destino } = parseDestino(notas);
  if ((DESTINOS_ALTA_TRASLADO as readonly string[]).includes(destino)) {
    return destino;
  }
  if (estado_destino) {
    const fromState = careStateToDestino(estado_destino);
    if (fromState) return fromState;
  }
  return destino;
}

export function isPacienteEnObservacion(
  notas: string | null | undefined,
  estado_destino: CareState | null | undefined,
): boolean {
  if (isReferidoHospitalNotas(notas) || estado_destino === "Hospitalizado") {
    return false;
  }

  const { destino } = parseDestino(notas);
  if ((DESTINOS_ALTA_TRASLADO as readonly string[]).includes(destino)) {
    return false;
  }
  return destino === OBSERVACION_MODULO_MOVIL && estado_destino === "Triaje";
}

export function isPacienteDadoDeAltaOTraslado(
  notas: string | null | undefined,
  estado_destino: CareState | null | undefined,
): boolean {
  if (isPacienteEnObservacion(notas, estado_destino)) return false;
  if (
    isReferidoHospitalNotas(notas) ||
    estado_destino === "Hospitalizado" ||
    estado_destino === "Alta Médica" ||
    estado_destino === "Transferido"
  ) {
    return true;
  }
  const label = resolveDestinoPaciente(notas, estado_destino);
  return (DESTINOS_ALTA_TRASLADO as readonly string[]).includes(label);
}

export function matchesDestinoFilter(
  notas: string | null | undefined,
  filterDestino: string,
): boolean {
  if (filterDestino === OBSERVACION_MODULO_MOVIL) {
    return isEnObservacionModulo(notas);
  }
  if (filterDestino === REFERIDO_HOSPITAL) {
    return isReferidoHospitalNotas(notas);
  }
  return trimNotas(notas).toLowerCase() === filterDestino.toLowerCase();
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
  if (isReferidoHospitalNotas(notas) || estado_destino === "Hospitalizado") {
    return REFERIDO_HOSPITAL;
  }

  const label = resolveDestinoPaciente(notas, estado_destino);
  if ((DESTINOS_ALTA_TRASLADO as readonly string[]).includes(label)) {
    return label;
  }
  return DESTINO_OTROS;
}
