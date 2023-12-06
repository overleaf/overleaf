export type SSOConfig = {
  entryPoint?: string
  certificates: (string | undefined)[]
  userIdAttribute?: string
  userFirstNameAttribute?: string
  userLastNameAttribute?: string
  validated?: boolean
  enabled?: boolean
}
