import { Brand } from '../helpers/brand'
import { ReviewPanelEntry } from './entry'

export type SubView = 'cur_file' | 'overview'

export interface ReviewPanelPermissions {
  read: boolean
  write: boolean
  admin: boolean
  comment: boolean
}

export type ReviewPanelDocEntries = Record<string, ReviewPanelEntry>

export type DocId = Brand<string, 'DocId'>
export type ReviewPanelEntries = Record<DocId, ReviewPanelDocEntries>
