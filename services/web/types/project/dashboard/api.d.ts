import { SortingOrder } from '../../sorting-order'
import { MergeAndOverride } from '../../utils'

export type Page = {
  size: number
  lastId?: string
}

export type Sort = {
  by: 'lastUpdated' | 'title' | 'owner'
  order: SortingOrder
}

export type Filters = {
  ownedByUser?: boolean
  sharedWithUser?: boolean
  archived?: boolean
  trashed?: boolean
  tag?: string | null
  search?: string
}

export type GetProjectsRequestBody = {
  page: Page
  sort: Sort
  filters: Filters
}

export type UserRef = {
  id: string
  email: string
  firstName: string
  lastName: string
}

export type ProjectApi = {
  id: string
  name: string
  owner?: UserRef
  lastUpdated: Date
  lastUpdatedBy: UserRef | null
  archived: boolean
  trashed: boolean
  accessLevel: 'owner' | 'readWrite' | 'readOnly' | 'readAndWrite'
  source: 'owner' | 'invite' | 'token'
}

export type Project = MergeAndOverride<
  ProjectApi,
  {
    lastUpdated: string
    selected?: boolean
  }
>

export type GetProjectsResponseBody = {
  totalSize: number
  projects: Project[]
}

export type ClonedProject = {
  project_id: string
  name: string
  lastUpdated: string
  owner: {
    _id: string
    email: string
    first_name: string
    last_name: string
  }
}
