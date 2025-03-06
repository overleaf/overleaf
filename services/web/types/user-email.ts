import { Affiliation } from './affiliation'

export type UserEmailData = {
  affiliation?: Affiliation
  confirmedAt?: string
  lastConfirmedAt?: string | null
  email: string
  default: boolean
  samlProviderId?: string
  emailHasInstitutionLicence?: boolean
}
