import { UserId } from '../../../../../types/user'
import { PublicAccessLevel } from '../../../../../types/public-access-level'
import { ProjectSettings } from '@/features/editor-left-menu/utils/api'
import { Folder } from '../../../../../types/folder'

export type ProjectMember = {
  _id: UserId
  privileges: 'readOnly' | 'readAndWrite' | 'review'
  email: string
  first_name: string
  last_name: string
  pendingEditor?: boolean
  pendingReviewer?: boolean
}

export interface ProjectMetadata extends ProjectSettings {
  _id: string
  mainBibliographyDocId?: string
  members: ProjectMember[]
  invites: ProjectMember[]
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
  rootFolder?: Folder[]
  trackChangesState: boolean | Record<UserId | '__guests__', boolean>
}

export type ProjectUpdate = Partial<ProjectMetadata>
