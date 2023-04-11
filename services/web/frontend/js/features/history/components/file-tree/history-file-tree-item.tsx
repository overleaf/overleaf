import type { ReactNode } from 'react'
import { DiffOperation } from '../../services/types/diff-operation'

type FileTreeItemProps = {
  name: string
  operation?: DiffOperation
  icons: ReactNode
}

export default function FileTreeItem({
  name,
  operation,
  icons,
}: FileTreeItemProps) {
  return (
    <div className="entity" role="presentation">
      <div className="entity-name entity-name-react" role="presentation">
        {icons}
        <button className="item-name-button">
          <span>{name}</span>
          {operation ? (
            <span className="history-file-entity-operation-badge">
              {operation}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  )
}
