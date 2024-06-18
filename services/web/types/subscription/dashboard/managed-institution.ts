export type ManagedInstitution = {
  v1Id: number
  managerIds: string[]
  metricsEmail: {
    optedOutUserIds: string[]
    lastSent: Date
  }
  name: string
}
