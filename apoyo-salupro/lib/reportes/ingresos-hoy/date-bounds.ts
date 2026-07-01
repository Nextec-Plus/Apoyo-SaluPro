/** Ventana UTC para "hoy" en Venezuela (UTC-4): medianoche VET = 04:00 UTC. */
export function getIngresosHoyUtcBounds(referenceDate = new Date()): {
  startUtc: string;
  endUtc: string;
  fechaVet: string;
} {
  const fechaVet = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate);

  const [y, m, d] = fechaVet.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

  return {
    startUtc: `${fechaVet} 04:00:00`,
    endUtc: `${tomorrow} 04:00:00`,
    fechaVet,
  };
}
