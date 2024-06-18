export type AccessToken = {
  _id: string
  accessTokenPartial: string
  createdAt: Date
  accessTokenExpiresAt: Date
  lastUsedAt?: Date
}

export type SAMLError = {
  translatedMessage?: string
  message?: string
  tryAgain?: boolean
}

export type InstitutionLink = {
  universityName: string
  hasEntitlement?: boolean
}
