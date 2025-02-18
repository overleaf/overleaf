export type Permissions = {
  read: boolean
  comment: boolean
  trackedWrite: boolean
  write: boolean
  admin: boolean
  labelVersion: boolean
}

export type PermissionsLevel = 'owner' | 'readAndWrite' | 'review' | 'readOnly'
