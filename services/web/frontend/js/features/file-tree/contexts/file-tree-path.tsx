import { createContext, FC, useCallback, useContext, useMemo } from 'react'
import { Folder } from '../../../../../types/folder'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import getMeta from '@/utils/meta'
import {
  findEntityByPath,
  previewByPath,
  dirname,
  FindResult,
  pathInFolder,
} from '@/features/file-tree/util/path'
import { PreviewPath } from '../../../../../types/preview-path'

type FileTreePathContextValue = {
  pathInFolder: (id: string) => string | null
  findEntityByPath: (path: string) => FindResult | null
  previewByPath: (path: string) => PreviewPath | null
  dirname: (id: string) => string | null
}

export const FileTreePathContext = createContext<
  FileTreePathContextValue | undefined
>(undefined)

export const FileTreePathProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { fileTreeData }: { fileTreeData: Folder } = useFileTreeData()
  const projectId = getMeta('ol-project_id')

  const pathInFileTree = useCallback(
    (id: string) => {
      if (!fileTreeData) return null
      return pathInFolder(fileTreeData, id)
    },
    [fileTreeData]
  )

  const findEntityByPathInFileTree = useCallback(
    (path: string) => {
      if (!fileTreeData) return null
      return findEntityByPath(fileTreeData, path)
    },
    [fileTreeData]
  )

  const previewByPathInFileTree = useCallback(
    (path: string) => {
      if (!fileTreeData) return null
      return previewByPath(fileTreeData, projectId, path)
    },
    [fileTreeData, projectId]
  )

  const dirnameInFileTree = useCallback(
    (id: string) => {
      if (!fileTreeData) return null
      return dirname(fileTreeData, id)
    },
    [fileTreeData]
  )

  const value = useMemo<FileTreePathContextValue>(
    () => ({
      pathInFolder: pathInFileTree,
      findEntityByPath: findEntityByPathInFileTree,
      previewByPath: previewByPathInFileTree,
      dirname: dirnameInFileTree,
    }),
    [
      pathInFileTree,
      findEntityByPathInFileTree,
      previewByPathInFileTree,
      dirnameInFileTree,
    ]
  )

  return (
    <FileTreePathContext.Provider value={value}>
      {children}
    </FileTreePathContext.Provider>
  )
}

export function useFileTreePathContext(): FileTreePathContextValue {
  const context = useContext(FileTreePathContext)

  if (!context) {
    throw new Error(
      'useFileTreePathContext is only available inside FileTreePathProvider'
    )
  }

  return context
}
