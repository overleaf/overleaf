import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useCallback } from 'react'
import { findInTree } from '@/features/file-tree/util/find-in-tree'

export function useSelectFileTreeEntity() {
  const { fileTreeData, selectedEntities, setSelectedEntities } =
    useFileTreeData()

  const selectEntity = useCallback(
    id => {
      if (
        selectedEntities.length === 1 &&
        selectedEntities[0].entity._id === id
      ) {
        return
      }
      const entityToSelect = findInTree(fileTreeData, id)
      if (entityToSelect) {
        setSelectedEntities([entityToSelect])
      }
    },
    [fileTreeData, selectedEntities, setSelectedEntities]
  )

  return { selectEntity }
}
