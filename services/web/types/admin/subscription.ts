import { GroupPolicy } from '../subscription/dashboard/subscription'
import { TeamInvite } from './team-invite'

export type Subscription = {
  _id: string
  teamInvites: TeamInvite[]
  groupPolicy: GroupPolicy
  admin_id: string
  groupPlan: boolean
  customAccount: boolean
  ssoConfig: object
}
