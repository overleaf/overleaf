export type AdminCapability =
  | 'clear-saml-data'
  | 'clear-session'
  | 'create-subscription'
  | 'modify-login-status'
  | 'modify-user-email'
  | 'modify-user-name'
  | 'view-project'
  | 'view-session'

export type AdminRole =
  | 'engagement'
  | 'engineering'
  | 'finance'
  | 'product'
  | 'sales'
  | 'support'
  | 'support_tier_1'
