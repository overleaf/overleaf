import { FileRef } from '../../../../../types/file-ref'
import { Folder } from '../../../../../types/folder'
import { Doc } from '../../../../../types/doc'

export type FileTreeFolderFindResultType = 'folder' | 'doc' | 'fileRef'

interface BaseFileTreeFindResult<T> {
  type: FileTreeFolderFindResultType
  entity: T
  parent: T[]
  parentFolderId: string
  path: string[]
  index: number
}

export interface FileTreeFolderFindResult extends BaseFileTreeFindResult<Folder> {
  type: 'folder'
}

export interface FileTreeDocumentFindResult extends BaseFileTreeFindResult<Doc> {
  type: 'doc'
}

export interface FileTreeFileRefFindResult extends BaseFileTreeFindResult<FileRef> {
  type: 'fileRef'
}

export type FileTreeFindResult =
  | FileTreeFolderFindResult
  | FileTreeDocumentFindResult
  | FileTreeFileRefFindResult

export const isFolderResult = (
  result: FileTreeFindResult
): result is FileTreeFolderFindResult => result.type === 'folder'

export const isDocResult = (
  result: FileTreeFindResult
): result is FileTreeDocumentFindResult => result.type === 'doc'

export const isFileRefResult = (
  result: FileTreeFindResult
): result is FileTreeFileRefFindResult => result.type === 'fileRef'
