export type SSOEnrollment = {
  groupId: string
  linkedAt: Date
  primary: boolean
}

export type UserEnrollment = {
  managedBy?: string
  enrolledAt?: Date
  sso?: SSOEnrollment[]
}

export type User = {
  _id: string
  email: string
  first_name: string
  last_name: string
  invite: boolean
  last_active_at: Date
  enrollment?: UserEnrollment
  isEntityAdmin?: boolean
}
