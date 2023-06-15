export type SubView = 'cur_file' | 'overview'

export interface ReviewPanelPermissions {
  read: boolean
  write: boolean
  admin: boolean
  comment: boolean
}
