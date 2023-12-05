import { useIdeContext } from '@/shared/context/ide-context'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useCallback } from 'react'
import { findInTree } from '@/features/file-tree/util/find-in-tree'

export function useOpenFile() {
  const ide = useIdeContext()

  const { fileTreeData } = useFileTreeData()

  const openFileWithId = useCallback(
    (id: string) => {
      const result = findInTree(fileTreeData, id)
      if (result?.type === 'fileRef') {
        window.dispatchEvent(new CustomEvent('editor.openDoc', { detail: id }))
      }
    },
    [fileTreeData]
  )

  // Expose BinaryFilesManager via ide object solely for the benefit of the file
  // restore feature in history. This can be removed once Angular is gone.
  ide.binaryFilesManager = { openFileWithId }
}
