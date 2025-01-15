import { UserId } from '../../../../../types/user'
import { PublicAccessLevel } from '../../../../../types/public-access-level'
import { ProjectSnapshot } from '@/infrastructure/project-snapshot'

export type ProjectContextMember = {
  _id: UserId
  privileges: 'readOnly' | 'readAndWrite'
  email: string
  first_name: string
  last_name: string
  pendingEditor?: boolean
}

export type ProjectContextValue = {
  _id: string
  name: string
  rootDocId?: string
  mainBibliographyDocId?: string
  compiler: string
  members: ProjectContextMember[]
  invites: ProjectContextMember[]
  features: {
    collaborators?: number
    compileGroup?: 'alpha' | 'standard' | 'priority'
    trackChanges?: boolean
    trackChangesVisible?: boolean
    references?: boolean
    mendeley?: boolean
    zotero?: boolean
    versioning?: boolean
    gitBridge?: boolean
    referencesSearch?: boolean
    github?: boolean
  }
  publicAccessLevel?: PublicAccessLevel
  owner: {
    _id: UserId
    email: string
    first_name: string
    last_name: string
    privileges: string
    signUpDate: string
  }
  tags: {
    _id: string
    name: string
    color?: string
  }[]
  trackChangesState: boolean | Record<UserId | '__guests__', boolean>
  projectSnapshot: ProjectSnapshot
}

export type ProjectContextUpdateValue = Partial<ProjectContextValue>
