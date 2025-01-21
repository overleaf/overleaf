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

export interface FileTreeFolderFindResult
  extends BaseFileTreeFindResult<Folder> {
  type: 'folder'
}

export interface FileTreeDocumentFindResult
  extends BaseFileTreeFindResult<Doc> {
  type: 'doc'
}

export interface FileTreeFileRefFindResult
  extends BaseFileTreeFindResult<FileRef> {
  type: 'fileRef'
}

export type FileTreeFindResult =
  | FileTreeFolderFindResult
  | FileTreeDocumentFindResult
  | FileTreeFileRefFindResult
