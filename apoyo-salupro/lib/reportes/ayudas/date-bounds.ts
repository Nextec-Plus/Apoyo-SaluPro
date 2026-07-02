/**
 * Ventana UTC para un rango de fechas en Venezuela (UTC-4): medianoche VET = 04:00 UTC.
 * `startVet`/`endVet` son "YYYY-MM-DD", inclusive en ambos extremos.
 */
export function getAyudasRangeUtcBounds(
  startVet: string,
  endVet: string,
): { startUtc: string; endUtc: string } {
  const [ey, em, ed] = endVet.split("-").map(Number);
  const endExclusiveVet = new Date(Date.UTC(ey, em - 1, ed + 1)).toISOString().slice(0, 10);

  return {
    startUtc: `${startVet} 04:00:00`,
    endUtc: `${endExclusiveVet} 04:00:00`,
  };
}
