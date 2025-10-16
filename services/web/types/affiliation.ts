import { Institution } from './institution'
import { Portal } from './portal'
import { Nullable } from './utils'

export type Affiliation = {
  cachedConfirmedAt: Nullable<string>
  cachedEntitlement: Nullable<boolean>
  cachedLastDayToReconfirm: Nullable<string>
  cachedPastReconfirmDate: boolean
  cachedReconfirmedAt: Nullable<string>
  department: Nullable<string>
  inReconfirmNotificationPeriod: boolean
  inferred: boolean
  institution: Institution
  licence: 'free' | 'pro_plus'
  pastReconfirmDate: boolean
  portal: Portal
  role: Nullable<string>
  group?: {
    domainCaptureEnabled: boolean
    managedUsersEnabled: boolean
    _id: string
  }
}
