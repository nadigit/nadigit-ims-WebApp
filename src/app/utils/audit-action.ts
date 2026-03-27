import { HttpHeaders } from '@angular/common/http';

/**
 * Adds an audit action header to HTTP headers.
 * Only requests with this header will be logged in the user action audit log.
 */
export function withAudit(headers: HttpHeaders, actionDescription: string): HttpHeaders {
  return headers.set('X-Audit-Action', actionDescription);
}

/**
 * Builds an audit description for save methods that handle both create and update.
 * Detects create vs update by checking if the entity has an ID.
 *
 * @param entityName  Human-readable entity type (e.g. "product", "order")
 * @param data        The entity data being saved
 * @param idField     The name of the ID field on the entity (e.g. "productId")
 * @param refField    Optional field name used as a human-readable reference (e.g. "reference", "name")
 */
export function auditSaveAction(entityName: string, data: any, idField: string, refField?: string): string {
  const isUpdate = data && data[idField] != null;
  const verb = isUpdate ? 'Updated' : 'Created new';
  let description = `${verb} ${entityName}`;
  if (refField && data && data[refField]) {
    description += ` '${data[refField]}'`;
  }
  return description;
}
