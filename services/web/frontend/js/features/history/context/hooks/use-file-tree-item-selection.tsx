import { useCallback, useMemo } from 'react'
import { useHistoryContext } from '../history-context'

export function useFileTreeItemSelection(pathname: string) {
  const { fileSelection, setFileSelection } = useHistoryContext()

  const handleClick = useCallback(() => {
    if (!fileSelection) {
      return
    }
    if (pathname !== fileSelection.pathname) {
      setFileSelection({
        files: fileSelection.files,
        pathname,
      })
    }
  }, [fileSelection, pathname, setFileSelection])

  const isSelected = useMemo(
    () => fileSelection?.pathname === pathname,
    [fileSelection, pathname]
  )

  return { isSelected, onClick: handleClick }
}
