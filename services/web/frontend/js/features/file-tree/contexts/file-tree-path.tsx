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
import { useSnapshotContext } from '@/features/ide-react/context/snapshot-context'

type FileTreePathContextValue = {
  pathInFolder: (id: string) => string | null
  findEntityByPath: (path: string) => FindResult | null
  previewByPath: (path: string) => PreviewPath | null
  dirname: (id: string) => string | null
}

export const FileTreePathContext = createContext<
  FileTreePathContextValue | undefined
>(undefined)

export const FileTreePathProvider: FC = ({ children }) => {
  const { fileTreeData }: { fileTreeData: Folder } = useFileTreeData()
  const { fileTreeFromHistory } = useSnapshotContext()
  const projectId = getMeta('ol-project_id')

  const pathInFileTree = useCallback(
    (id: string) => pathInFolder(fileTreeData, id),
    [fileTreeData]
  )

  const findEntityByPathInFileTree = useCallback(
    (path: string) => findEntityByPath(fileTreeData, path),
    [fileTreeData]
  )

  const previewByPathInFileTree = useCallback(
    (path: string) =>
      previewByPath(fileTreeData, projectId, path, fileTreeFromHistory),
    [fileTreeData, projectId, fileTreeFromHistory]
  )

  const dirnameInFileTree = useCallback(
    (id: string) => dirname(fileTreeData, id),
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
