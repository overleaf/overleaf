import { useFileTreeSelectable } from '../contexts/file-tree-selectable'
import { FC, useCallback } from 'react'

const FileTreeInner: FC<React.PropsWithChildren> = ({ children }) => {
  const { setIsRootFolderSelected, selectedEntityIds, select } =
    useFileTreeSelectable()

  const handleFileTreeClick = useCallback(() => {
    setIsRootFolderSelected(true)
    if (selectedEntityIds.size > 1) {
      select([])
    }
  }, [select, selectedEntityIds.size, setIsRootFolderSelected])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="file-tree-inner"
      onClick={handleFileTreeClick}
      data-testid="file-tree-inner"
    >
      {children}
    </div>
  )
}

export default FileTreeInner
