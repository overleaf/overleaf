export type UserEnrollment = {
  managedBy: string
  enrolledAt: Date
}

export type User = {
  _id: string
  email: string
  first_name: string
  last_name: string
  invite: boolean
  last_active_at: Date
  enrollment: UserEnrollment | undefined
  isEntityAdmin: boolean | undefined
}
