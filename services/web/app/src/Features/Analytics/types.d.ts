export type AccountMapping = {
  source: string
  sourceEntity: string
  sourceEntityId: string
  target: string
  targetEntity: string
  targetEntityId: string
  createdAt: string
}

export type EmailChangePayload = {
  userId: string
  email: string
  isPrimary: boolean
  action: 'created' | 'deleted' | 'updated'
  createdAt: string
  emailDeletedAt?: string | null
  emailCreatedAt?: string | null
  emailConfirmedAt?: string | null
}
