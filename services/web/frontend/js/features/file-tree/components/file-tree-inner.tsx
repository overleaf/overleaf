import { useFileTreeSelectable } from '../contexts/file-tree-selectable'

type FileTreeInnerProps = {
  children: React.ReactNode
}

function FileTreeInner({ children }: FileTreeInnerProps) {
  const { setIsRootFolderSelected } = useFileTreeSelectable()

  const handleFileTreeClick = () => {
    setIsRootFolderSelected(true)
  }

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
