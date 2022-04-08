import { Institution } from './institution'

export type Affiliation = {
  institution: Institution
  licence?: 'free' | 'pro_plus'
}
