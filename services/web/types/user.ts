import { Brand } from './helpers/brand'

export type RefProviders = {
  mendeley?: boolean
  zotero?: boolean
}

export type UserId = Brand<string, 'UserId'>

export type User = {
  id: UserId
  email: string
  allowedFreeTrial?: boolean
  signUpDate?: string // date string
  features?: {
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
  refProviders?: RefProviders
}

export type MongoUser = Pick<User, Exclude<keyof User, 'id'>> & { _id: string }
