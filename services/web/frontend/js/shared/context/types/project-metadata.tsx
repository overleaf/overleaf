import { UserId } from '../../../../../types/user'
import { PublicAccessLevel } from '../../../../../types/public-access-level'
import { ProjectSettings } from '@/features/ide-settings/utils/api'
import { Folder } from '../../../../../types/folder'
import { ExtractStrict } from '../../../../../types/utils'

export type ProjectMember = {
  _id: UserId
  privileges: 'readOnly' | 'readAndWrite' | 'review'
  email: string
  first_name: string
  last_name: string
  pendingEditor?: boolean
  pendingReviewer?: boolean
}

export type ProjectOwner = {
  _id: UserId
  email: string
  first_name: string
  last_name: string
  privileges: string
  signUpDate: string
}

// The privilege levels a viewer/reviewer may request (never 'readOnly' or
// 'owner'). Derived from the collaborator union so the literals aren't
// duplicated across the request-access UI and API helpers.
export type RequestedPrivilegeLevel = ExtractStrict<
  ProjectMember['privileges'],
  'readAndWrite' | 'review'
>

export type EditAccessRequest = {
  _id: UserId
  email: string
  first_name: string
  last_name: string
  privilegeLevel: RequestedPrivilegeLevel
  // the requester's *current* privilege on the project, so the owner UI can
  // tell whether granting would consume a new collaborator slot
  currentPrivilegeLevel: ProjectMember['privileges']
  requestedAt: string
}

export type MyAccessRequest = Pick<
  EditAccessRequest,
  'privilegeLevel' | 'requestedAt'
> | null

export interface ProjectMetadata extends ProjectSettings {
  _id: string
  members: ProjectMember[]
  invites: ProjectMember[]
  editAccessRequests?: EditAccessRequest[]
  myAccessRequest?: MyAccessRequest
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
  owner: ProjectOwner
  rootFolder?: Folder[]
  trackChangesState?: false | TrackChangesStateData
}

// The explicit per-user track changes format, keyed by user id. The
// `__guests__` key toggles track changes for link-sharing guests (it is still
// used by some Server Pro organisations)
export type TrackChangesStateData = Partial<
  Record<UserId | '__guests__', boolean>
>

export type ProjectUpdate = Partial<ProjectMetadata>
