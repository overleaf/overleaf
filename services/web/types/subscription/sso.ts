export type Certificate = {
  id: string
  value?: string
  validFrom?: Date
  validTo?: Date
}

export type SSOConfig = {
  entryPoint?: string
  certificates: Certificate[]
  userIdAttribute?: string
  userFirstNameAttribute?: string
  userLastNameAttribute?: string
  validated?: boolean
  enabled?: boolean
}
