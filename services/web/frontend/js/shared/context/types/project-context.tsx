import { UserId } from '../../../../../types/user'
import { PublicAccessLevel } from '../../../../../types/public-access-level'
import type * as ReviewPanel from '@/features/source-editor/context/review-panel/types/review-panel-state'

export type ProjectContextMember = {
  _id: UserId
  privileges: 'readOnly' | 'readAndWrite'
  email: string
}

export type ProjectContextValue = {
  _id: string
  name: string
  rootDocId?: string
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
  }
  tags: {
    _id: string
    name: string
    color?: string
  }[]
  trackChangesState: ReviewPanel.Value<'trackChangesState'>
}

export type ProjectContextUpdateValue = Partial<ProjectContextValue>
