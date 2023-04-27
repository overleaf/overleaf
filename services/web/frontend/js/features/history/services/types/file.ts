import { FileOperation } from './file-operation'

export interface FileUnchanged {
  pathname: string
}

export interface FileAdded extends FileUnchanged {
  operation: Extract<FileOperation, 'added'>
}

export interface FileRemoved extends FileUnchanged {
  operation: Extract<FileOperation, 'removed'>
  newPathname?: string
  deletedAtV: number
}

export interface FileEdited extends FileUnchanged {
  operation: Extract<FileOperation, 'edited'>
}

export interface FileRenamed extends FileUnchanged {
  newPathname?: string
  oldPathname?: string
  operation: Extract<FileOperation, 'renamed'>
}

export type FileDiff =
  | FileAdded
  | FileRemoved
  | FileEdited
  | FileRenamed
  | FileUnchanged
