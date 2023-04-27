import { useCallback } from 'react'
import { useHistoryContext } from '../history-context'
import type { FileDiff } from '../../services/types/file'

export function useFileTreeItemSelection(file: FileDiff) {
  const { selection, setSelection } = useHistoryContext()

  const handleClick = useCallback(() => {
    if (file.pathname !== selection.selectedFile?.pathname) {
      setSelection({
        ...selection,
        selectedFile: file,
      })
    }
  }, [file, selection, setSelection])

  const isSelected = selection.selectedFile?.pathname === file.pathname

  return { isSelected, onClick: handleClick }
}
