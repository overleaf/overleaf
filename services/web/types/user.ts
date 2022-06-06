export type User = {
  id: string
  email: string
  allowedFreeTrial?: boolean
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
}

export type MongoUser = Pick<User, Exclude<keyof User, 'id'>> & { _id: string }
