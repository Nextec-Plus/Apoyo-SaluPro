import type { TriageCategory } from "@/lib/types/database";

/** Labels aligned with the triage board columns (tab-triaje). */
export const TRIAGE_LEVELS: readonly {
  id: TriageCategory;
  barLabel: string;
  cardLabel: string;
  sub: string;
}[] = [
  {
    id: "Verde",
    barLabel: "🟢 Verde",
    cardLabel: "Triaje verde",
    sub: "Leve / Ambulatorio",
  },
  {
    id: "Amarillo",
    barLabel: "🟡 Amarillo",
    cardLabel: "Triaje amarillo",
    sub: "Moderado / Observación",
  },
  {
    id: "Rojo",
    barLabel: "🔴 Rojo",
    cardLabel: "Triaje rojo",
    sub: "Grave / Emergencia Inmediata",
  },
] as const;

export const TRIAGE_LEVEL_BY_ID: Record<
  TriageCategory,
  (typeof TRIAGE_LEVELS)[number]
> = Object.fromEntries(TRIAGE_LEVELS.map((t) => [t.id, t])) as Record<
  TriageCategory,
  (typeof TRIAGE_LEVELS)[number]
>;
