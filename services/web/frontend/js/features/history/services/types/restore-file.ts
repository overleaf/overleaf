export type RestoreFileResponse = {
  id: string
  type: 'doc' | 'file'
}

export type RestoreProjectResponse = Array<{
  id: string
  path: string
  type: 'doc' | 'file'
}>
