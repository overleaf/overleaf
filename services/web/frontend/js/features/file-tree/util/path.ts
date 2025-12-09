import { Folder } from '../../../../../types/folder'
import { FileTreeEntity } from '../../../../../types/file-tree-entity'
import { Doc } from '../../../../../types/doc'
import { FileRef } from '../../../../../types/file-ref'
import { PreviewPath } from '../../../../../types/preview-path'

type DocFindResult = {
  entity: Doc
  type: 'doc'
}

type FolderFindResult = {
  entity: Folder
  type: 'folder'
}

type FileRefFindResult = {
  entity: FileRef
  type: 'fileRef'
}

export type FindResult = DocFindResult | FolderFindResult | FileRefFindResult

// Finds the entity with a given ID in the tree represented by `folder` and
// returns a path to that entity, represented by an array of folders starting at
// the root plus the entity itself
function pathComponentsInFolder(
  folder: Folder,
  id: string,
  ancestors: FileTreeEntity[] = []
): FileTreeEntity[] | null {
  const docOrFileRef =
    folder.docs.find(doc => doc._id === id) ||
    folder.fileRefs.find(fileRef => fileRef._id === id)
  if (docOrFileRef) {
    return ancestors.concat([docOrFileRef])
  }

  for (const subfolder of folder.folders) {
    if (subfolder._id === id) {
      return ancestors.concat([subfolder])
    } else {
      const path = pathComponentsInFolder(
        subfolder,
        id,
        ancestors.concat([subfolder])
      )
      if (path !== null) {
        return path
      }
    }
  }

  return null
}

// Finds the entity with a given ID in the tree represented by `folder` and
// returns a path to that entity as a string
export function pathInFolder(folder: Folder, id: string): string | null {
  return (
    pathComponentsInFolder(folder, id)
      ?.map(entity => entity.name)
      .join('/') || null
  )
}

export function findEntityByPath(
  folder: Folder,
  path: string
): FindResult | null {
  if (path === '') {
    return { entity: folder, type: 'folder' }
  }

  const parts = path.split('/')
  const name = parts.shift()
  const rest = parts.join('/')

  if (name === '.') {
    return findEntityByPath(folder, rest)
  }

  const doc = folder.docs.find(doc => doc.name === name)
  if (doc) {
    return { entity: doc, type: 'doc' }
  }

  const fileRef = folder.fileRefs.find(fileRef => fileRef.name === name)
  if (fileRef) {
    return { entity: fileRef, type: 'fileRef' }
  }

  for (const subfolder of folder.folders) {
    if (subfolder.name === name) {
      if (rest === '') {
        return { entity: subfolder, type: 'folder' }
      } else {
        return findEntityByPath(subfolder, rest)
      }
    }
  }

  return null
}

export function previewByPath(
  folder: Folder,
  projectId: string,
  path: string
): PreviewPath | null {
  for (const suffix of [
    '',
    '.png',
    '.jpg',
    '.jpeg',
    '.pdf',
    '.svg',
    '.PNG',
    '.JPG',
    '.JPEG',
    '.PDF',
    '.SVG',
  ]) {
    const result = findEntityByPath(folder, path + suffix)

    if (result?.type === 'fileRef') {
      const { name, hash } = result.entity
      const extension = name.slice(name.lastIndexOf('.') + 1)
      const url = `/project/${projectId}/blob/${hash}`
      return { url, extension }
    }
  }
  return null
}

export function dirname(fileTreeData: Folder, id: string) {
  const path = pathInFolder(fileTreeData, id)
  return path?.split('/').slice(0, -1).join('/') || null
}
