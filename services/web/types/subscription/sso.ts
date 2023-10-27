export type SSOConfig = {
  entryPoint?: string
  certificates: (string | undefined)[]
  signatureAlgorithm: 'sha1' | 'sha256' | 'sha512'
  userIdAttribute?: string
  userFirstNameAttribute?: string
  userLastNameAttribute?: string
  enabled?: boolean
}
