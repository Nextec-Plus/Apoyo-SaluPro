/**
 * Alcance de consultas sobre missing_persons para la crisis activa.
 *
 * La mayoría de reportes públicos tienen organization_id NULL; los nuevos del
 * dashboard usan la org por defecto. En ambos casos pertenecen a la misma
 * operación, así que contamos org = X OR organization_id IS NULL.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder de PostgREST
export function scopeMissingPersonsByOrg(query: any, organizationId: string) {
  return query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
}
