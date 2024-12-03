export type Permissions = {
  read: boolean
  write: boolean
  admin: boolean
  comment: boolean
}

export type PermissionsLevel = 'owner' | 'readAndWrite' | 'readOnly'
