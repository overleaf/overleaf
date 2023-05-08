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
      <div className="history-file-tree-item-name-wrapper">
        <div
          className={classNames('history-file-tree-item-name', {
            strikethrough: operation === 'removed',
          })}
        >
          {name}
        </div>
        {operation ? (
          <Badge className="history-file-tree-item-badge" size="sm">
            {operation}
          </Badge>
        ) : null}
      </div>
    </div>
  )
}
