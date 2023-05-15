import { Entity } from '../../file-tree/hooks/use-project-entities'
import { OutputEntity } from '../../file-tree/hooks/use-project-output-files'

export type FileOrDirectory = {
  name: string
  id: string
  type: 'file' | 'doc' | 'folder'
  children?: FileOrDirectory[]
}

export type File = {
  path: string
  name: string
  id: string
}

function filterByType(type: 'file' | 'doc' | 'folder') {
  return (
    tree: FileOrDirectory,
    path = '',
    list: undefined | File[] = undefined
  ) => {
    if (!tree) {
      return list
    }
    if (list === undefined) {
      list = []
    }
    const isRootFolder = tree.name === 'rootFolder' && path === ''
    if (tree.children) {
      for (const child of tree.children) {
        filterByType(type)(
          child,
          `${isRootFolder ? '' : `${path ? path + '/' : path}${tree.name}/`}`,
          list
        )
      }
    }
    if (tree.type === type) {
      list.push({ path, id: tree.id, name: tree.name })
    }
    return list
  }
}

export const filterFiles = filterByType('file')
export const filterDocs = filterByType('doc')
export const filterFolders = filterByType('folder')

const IMAGE_FILE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf']

export function isImageFile(file: File) {
  const parts = file.name.split('.')
  if (parts.length < 2) {
    return false
  }
  const extension = parts[parts.length - 1].toLowerCase()
  return IMAGE_FILE_EXTENSIONS.includes(extension)
}

export function isImageEntity(file: Entity | OutputEntity) {
  const parts = file.path.split('.')
  if (parts.length < 2) {
    return false
  }
  const extension = parts[parts.length - 1].toLowerCase()
  return IMAGE_FILE_EXTENSIONS.includes(extension)
}
