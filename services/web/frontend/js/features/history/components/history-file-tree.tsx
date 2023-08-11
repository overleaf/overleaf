import { useMemo, useEffect, useState } from 'react'
import { orderBy, reduce } from 'lodash'
import { useHistoryContext } from '../context/history-context'
import {
  fileTreeDiffToFileTreeData,
  reducePathsToTree,
} from '../utils/file-tree'
import HistoryFileTreeFolderList from './file-tree/history-file-tree-folder-list'
import { fileTreeContainer } from './history-root'

export default function HistoryFileTree() {
  const { selection } = useHistoryContext()
  const [shouldShowVisualSelection, setShouldShowVisualSelection] =
    useState(true)

  const fileTree = useMemo(
    () => reduce(selection.files, reducePathsToTree, []),
    [selection.files]
  )

  const sortedFileTree = useMemo(
    () => orderBy(fileTree, ['-type', 'operation', 'name']),
    [fileTree]
  )

  const mappedFileTree = useMemo(
    () => fileTreeDiffToFileTreeData(sortedFileTree),
    [sortedFileTree]
  )

  useEffect(() => {
    const listener = function (e: MouseEvent) {
      if ((e.target as HTMLElement).classList.contains('bottom-buffer')) {
        setShouldShowVisualSelection(false)
        return
      }

      setShouldShowVisualSelection(e.target !== e.currentTarget)
    }

    fileTreeContainer?.addEventListener('click', listener)

    return () => {
      fileTreeContainer?.removeEventListener('click', listener)
    }
  }, [])

  return (
    <HistoryFileTreeFolderList
      folders={mappedFileTree.folders}
      docs={mappedFileTree.docs ?? []}
      rootClassName="history-file-tree-list"
      shouldShowVisualSelection={shouldShowVisualSelection}
    >
      <li className="bottom-buffer" />
    </HistoryFileTreeFolderList>
  )
}
