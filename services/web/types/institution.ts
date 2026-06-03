import { Nullable } from './utils'

export type Institution = {
  commonsAccount: boolean
  enterpriseCommons: boolean
  writefullCommonsAccount: boolean
  confirmed: boolean
  id: number
  isUniversity: boolean
  maxConfirmationMonths: Nullable<number>
  name: string
  ssoBeta: boolean
  ssoEnabled: boolean
}
