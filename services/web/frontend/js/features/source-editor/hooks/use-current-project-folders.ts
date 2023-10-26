import { useMemo } from 'react'
import { File, FileOrDirectory, filterFolders } from '../utils/file'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { Folder } from '../../../../../types/folder'
import { Doc } from '../../../../../types/doc'
import { FileRef } from '../../../../../types/file-ref'

function docAdapter(doc: Doc): FileOrDirectory {
  return {
    id: doc._id,
    name: doc.name,
    type: 'doc',
  }
}

function fileRefAdapter(fileRef: FileRef): FileOrDirectory {
  return {
    id: fileRef._id,
    name: fileRef.name,
    type: 'file',
  }
}

function folderAdapter(folder: Folder): FileOrDirectory {
  return {
    id: folder._id,
    name: folder.name,
    type: 'folder',
    children: folder.docs
      .map(docAdapter)
      .concat(
        folder.fileRefs.map(fileRefAdapter),
        folder.folders.map(folderAdapter)
      ),
  }
}

export const useCurrentProjectFolders: () => {
  folders: File[] | undefined
  rootFile: File
  rootFolder: FileOrDirectory
} = () => {
  const { fileTreeData } = useFileTreeData()

  return useMemo(() => {
    const rootFolder = folderAdapter(fileTreeData)
    const rootFile = { ...rootFolder, path: '' }
    const folders = filterFolders(rootFolder)
    return { folders, rootFile, rootFolder }
  }, [fileTreeData])
}
