export type GroupAuditLog = {
  groupId: string
  operation: string
  ipAddress?: string
  initiatorId?: string
  info?: object
}
