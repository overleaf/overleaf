import { Nullable } from './utils'

export type Institution = {
  commonsAccount: boolean
  writefullCommonsAccount: boolean
  confirmed: boolean
  id: number
  isUniversity: boolean
  maxConfirmationMonths: Nullable<number>
  name: string
  ssoBeta: boolean
  ssoEnabled: boolean
}
