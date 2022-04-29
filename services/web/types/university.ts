import { CountryCode } from './country'

export type University = {
  id: number
  name: string
  country_code: CountryCode
  departments: string[]
}
