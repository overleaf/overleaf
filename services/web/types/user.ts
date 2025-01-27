import { Brand } from './helpers/brand'

export type RefProviders = {
  mendeley?: boolean
  papers?: boolean
  zotero?: boolean
}

export type UserId = Brand<string, 'UserId'>

export type Features = {
  aiErrorAssistant?: boolean
  collaborators?: number
  compileGroup?: 'standard' | 'priority'
  compileTimeout?: number
  dropbox?: boolean
  gitBridge?: boolean
  github?: boolean
  mendeley?: boolean
  papers?: boolean
  references?: boolean
  referencesSearch?: boolean
  symbolPalette?: boolean
  templates?: boolean
  trackChanges?: boolean
  versioning?: boolean
  zotero?: boolean
}

export type FeatureUsage = {
  [feature: string]: {
    remainingUsage: number
    resetDate: string // date string
  }
}

export type User = {
  id: UserId
  isAdmin?: boolean
  email: string
  allowedFreeTrial?: boolean
  hasRecurlySubscription?: boolean
  first_name?: string
  last_name?: string
  alphaProgram?: boolean
  betaProgram?: boolean
  labsProgram?: boolean
  isLatexBeginner?: boolean
  signUpDate?: string // date string
  features?: Features
  refProviders?: RefProviders
  writefull?: {
    enabled: boolean
    autoCreatedAccount: boolean
    firstAutoLoad: boolean
  }
  aiErrorAssistant?: {
    enabled: boolean
  }
  featureUsage?: FeatureUsage
}

export type LoggedOutUser = {
  id: null
  email?: undefined
  first_name?: undefined
  last_name?: undefined
  signUpDate?: undefined
  labsProgram?: undefined
  alphaProgram?: undefined
  betaProgram?: undefined
  allowedFreeTrial?: undefined
  features?: undefined
  refProviders?: undefined
  writefull?: undefined
  isAdmin?: undefined
  featureUsage?: undefined
}

export type MongoUser = Pick<User, Exclude<keyof User, 'id'>> & { _id: string }
