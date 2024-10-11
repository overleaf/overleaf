import { Brand } from './helpers/brand'

export type RefProviders = {
  mendeley?: boolean
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
  references?: boolean
  referencesSearch?: boolean
  symbolPalette?: boolean
  templates?: boolean
  trackChanges?: boolean
  versioning?: boolean
  zotero?: boolean
}

export type User = {
  id: UserId | null
  isAdmin?: boolean
  email: string
  allowedFreeTrial?: boolean
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
}

export type MongoUser = Pick<User, Exclude<keyof User, 'id'>> & { _id: string }
