import classNames from 'classnames'
import type { ReactNode } from 'react'
import type { FileOperation } from '../../services/types/file-operation'
import Badge from '../../../../shared/components/badge'

type FileTreeItemProps = {
  name: string
  operation?: FileOperation
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
        <span
          className={classNames('history-file-tree-item-button-text', {
            strikethrough: operation === 'removed',
          })}
        >
          {name}
        </span>
        {operation ? (
          <Badge className="history-file-tree-item-button-badge" size="sm">
            {operation}
          </Badge>
        ) : null}
      </button>
    </div>
  )
}
