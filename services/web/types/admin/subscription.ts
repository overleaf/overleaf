import { GroupPolicy } from '../subscription/dashboard/subscription'
import { SSOConfig } from '../subscription/sso'
import { TeamInvite } from '../team-invite'

export type Subscription = {
  _id: string
  teamInvites: TeamInvite[]
  groupPolicy: GroupPolicy
  admin_id: string
  groupPlan: boolean
  customAccount: boolean
  ssoConfig: SSOConfig
  managedUsersEnabled: boolean
  v1_id: number
  salesforce_id: string
}
