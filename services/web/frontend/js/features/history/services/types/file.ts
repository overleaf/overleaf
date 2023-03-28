export interface FileUnchanged {
  pathname: string
}

export interface FileAdded extends FileUnchanged {
  operation: 'added'
}

export interface FileRemoved extends FileUnchanged {
  operation: 'removed'
  deletedAtV: number
}

export interface FileRenamed extends FileUnchanged {
  newPathname?: string
  oldPathname?: string
  operation: 'renamed'
}

export type FileDiff = FileAdded | FileRemoved | FileRenamed | FileUnchanged

export interface FileSelection {
  files: FileDiff[]
  pathname: string | null
}
