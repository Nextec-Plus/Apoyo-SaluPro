export const REFERIDO_HOSPITAL = "Referido al Hospital";

export const DESTINOS = [
  "En observación en módulo móvil",
  "Dado de alta (Ambulatorio)",
  REFERIDO_HOSPITAL,
  "Trasladado a Refugio Oficial",
] as const;

export type DestinoOption = (typeof DESTINOS)[number];

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
