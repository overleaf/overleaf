import { useCallback } from 'react'
import { useHistoryContext } from '../history-context'

export function useFileTreeItemSelection(pathname: string) {
  const { selection, setSelection } = useHistoryContext()

  const handleClick = useCallback(() => {
    if (pathname !== selection.pathname) {
      setSelection({
        ...selection,
        pathname,
      })
    }
  }, [pathname, selection, setSelection])

  const isSelected = selection.pathname === pathname

  return { isSelected, onClick: handleClick }
}
