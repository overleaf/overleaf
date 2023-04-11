import { useCallback, useMemo } from 'react'
import { useHistoryContext } from '../history-context'

export function useFileTreeItemSelection(pathname: string) {
  const { fileSelection, setFileSelection, selection } = useHistoryContext()

  const handleClick = useCallback(() => {
    if (pathname !== fileSelection?.pathname) {
      setFileSelection({
        files: fileSelection?.files || selection.files,
        pathname,
      })
    }
  }, [fileSelection, pathname, selection, setFileSelection])

  const isSelected = useMemo(
    () => fileSelection?.pathname === pathname,
    [fileSelection, pathname]
  )

  return { isSelected, onClick: handleClick }
}
