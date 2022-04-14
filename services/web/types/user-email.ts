import { Affiliation } from './affiliation'

export type UserEmailData = {
  affiliation?: Affiliation
  confirmedAt?: string
  email: string
  default: boolean
  ssoAvailable?: boolean
}
