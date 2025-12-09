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
export const filterFolders = filterByType('folder')

const IMAGE_FILE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf', 'eps', 'svg']

export const getFileExtension = (filename: string): string | null => {
  const parts = filename.split('.')
  if (parts.length < 2) {
    return null
  }
  return parts[parts.length - 1].toLowerCase()
}

export const hasImageExtension = (filename: string) => {
  const extension = getFileExtension(filename)
  return extension !== null && IMAGE_FILE_EXTENSIONS.includes(extension)
}

export const isSvgFile = (filename: string): boolean => {
  return getFileExtension(filename) === 'svg'
}

export function isImageFile(file: File) {
  return hasImageExtension(file.name)
}

export function isImageEntity(file: Entity | OutputEntity) {
  return hasImageExtension(file.path)
}
