import type { ReactNode } from 'react'
import type { DiffOperation } from '../../services/types/diff-operation'
import Badge from '../../../../shared/components/badge'

type FileTreeItemProps = {
  name: string
  operation?: DiffOperation
  icons: ReactNode
}

export default function HistoryFileTreeItem({
  name,
  operation,
  icons,
}: FileTreeItemProps) {
  return (
    <div className="history-file-tree-item" role="presentation">
      {icons}
      <button className="history-file-tree-item-button">
        <span className="history-file-tree-item-button-text">{name}</span>
        {operation ? (
          <Badge className="history-file-tree-item-button-badge" size="sm">
            {operation}
          </Badge>
        ) : null}
      </button>
    </div>
  )
}
