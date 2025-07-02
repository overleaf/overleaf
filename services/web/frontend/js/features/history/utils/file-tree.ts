import _ from 'lodash'
import type { FileDiff, FileRenamed } from '../services/types/file'
import { isFileChanged, isFileEditable, isFileRemoved } from './file-diff'

export type FileTreeEntity = {
  name?: string
  type?: 'file' | 'folder'
  children?: FileTreeEntity[]
} & FileDiff

export function reducePathsToTree(
  currentFileTree: FileTreeEntity[],
  fileObject: FileTreeEntity
) {
  const filePathParts = fileObject?.pathname?.split('/') ?? ''
  let currentFileTreeLocation = currentFileTree

  for (let index = 0; index < filePathParts.length; index++) {
    const pathPart = filePathParts[index]
    const isFile = index === filePathParts.length - 1

    if (isFile) {
      const fileTreeEntity: FileTreeEntity = _.clone(fileObject)
      fileTreeEntity.name = pathPart
      fileTreeEntity.type = 'file'

      currentFileTreeLocation.push(fileTreeEntity)
    } else {
      let fileTreeEntity: FileTreeEntity | undefined = _.find(
        currentFileTreeLocation,
        entity => entity.name === pathPart
      )

      if (fileTreeEntity === undefined) {
        fileTreeEntity = {
          name: pathPart,
          type: 'folder',
          children: <FileTreeEntity[]>[],
          pathname: pathPart,
          editable: false,
        }

        currentFileTreeLocation.push(fileTreeEntity)
      }
      currentFileTreeLocation = fileTreeEntity.children ?? []
    }
  }
  return currentFileTree
}

export type HistoryDoc = {
  name: string
} & FileDiff

export type HistoryFileTree = {
  docs?: HistoryDoc[]
  folders: HistoryFileTree[]
  name: string
}

export function fileTreeDiffToFileTreeData(
  fileTreeDiff: FileTreeEntity[],
  currentFolderName = 'rootFolder' // default value from angular version
): HistoryFileTree {
  const folders: HistoryFileTree[] = []
  const docs: HistoryDoc[] = []

  for (const fileDiff of fileTreeDiff) {
    if (fileDiff.type === 'file') {
      if (isFileChanged(fileDiff)) {
        docs.push({
          pathname: fileDiff.pathname ?? '',
          name: fileDiff.name ?? '',
          editable: isFileEditable(fileDiff),
          operation: fileDiff.operation,
          deletedAtV: isFileRemoved(fileDiff) ? fileDiff.deletedAtV : undefined,
        })
      } else {
        docs.push({
          pathname: fileDiff.pathname ?? '',
          name: fileDiff.name ?? '',
          editable: isFileEditable(fileDiff),
        })
      }
    } else if (fileDiff.type === 'folder') {
      if (fileDiff.children) {
        const folder = fileTreeDiffToFileTreeData(
          fileDiff.children,
          fileDiff.name
        )
        folders.push(folder)
      }
    }
  }

  return {
    docs,
    folders,
    name: currentFolderName,
  }
}

// TODO: refactor the oldPathname/newPathname data
// It's an artifact from the angular version.
// Our API returns `pathname` and `newPathname` for `renamed` operation
// In the angular version, we change the key of the data:
// 1. `pathname` -> `oldPathname`
// 2. `newPathname` -> `pathname`
// 3. Delete the `newPathname` key from the object
// This is because the angular version wants to generalize the API usage
// In the operation other than the `renamed` operation, the diff API (/project/:id/diff) consumes the `pathname`
// But the `renamed` operation consumes the `newPathname` instead of the `pathname` data
//
// This behaviour can be refactored by introducing a conditional when calling the API
// i.e if `renamed` -> use `newPathname`, else -> use `pathname`
export function renamePathnameKey(file: FileRenamed): FileRenamed {
  return {
    oldPathname: file.pathname,
    pathname: file.newPathname as string,
    operation: file.operation,
    editable: file.editable,
  }
}
