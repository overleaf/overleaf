export interface HttpPermissionsPolicyRule {
  [key: string]: string
}

export interface HttpPermissionsPolicy {
  blocked: [string]
  allowed: HttpPermissionsPolicyRule
}
