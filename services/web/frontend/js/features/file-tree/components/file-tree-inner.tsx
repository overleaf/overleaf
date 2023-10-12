import { useFileTreeSelectable } from '../contexts/file-tree-selectable'
import { useCallback } from 'react'

type FileTreeInnerProps = {
  children: React.ReactNode
}

function FileTreeInner({ children }: FileTreeInnerProps) {
  const { setIsRootFolderSelected } = useFileTreeSelectable()

  const handleFileTreeClick = useCallback(() => {
    setIsRootFolderSelected(true)
  }, [setIsRootFolderSelected])

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
