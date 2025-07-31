import { FileOperation } from './file-operation'

interface File {
  pathname: string
}

export interface FileWithEditable extends File {
  editable: boolean
}

export type FileUnchanged = FileWithEditable

export interface FileAdded extends FileWithEditable {
  operation: Extract<FileOperation, 'added'>
}

export interface FileRemoved extends FileWithEditable {
  operation: Extract<FileOperation, 'removed'>
  newPathname?: string
  deletedAtV: number
}

export interface FileEdited extends File {
  operation: Extract<FileOperation, 'edited'>
}

export interface FileRenamed extends FileWithEditable {
  newPathname?: string
  oldPathname?: string
  operation: Extract<FileOperation, 'renamed'>
}

export type FileChanged = FileAdded | FileRemoved | FileEdited | FileRenamed
export type FileDiff = FileChanged | FileUnchanged
