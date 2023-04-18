import { DiffOperation } from './diff-operation'

export interface FileUnchanged {
  pathname: string
}

export interface FileAdded extends FileUnchanged {
  operation: Extract<DiffOperation, 'added'>
}

export interface FileRemoved extends FileUnchanged {
  operation: Extract<DiffOperation, 'removed'>
  newPathname?: string
  deletedAtV: number
}

export interface FileEdited extends FileUnchanged {
  operation: Extract<DiffOperation, 'edited'>
}

export interface FileRenamed extends FileUnchanged {
  newPathname?: string
  oldPathname?: string
  operation: Extract<DiffOperation, 'renamed'>
}

export type FileDiff =
  | FileAdded
  | FileRemoved
  | FileEdited
  | FileRenamed
  | FileUnchanged
