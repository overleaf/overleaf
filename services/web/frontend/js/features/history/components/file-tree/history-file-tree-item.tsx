import type { ReactNode } from 'react'
import type { DiffOperation } from '../../services/types/diff-operation'
import Badge from '../../../../shared/components/badge'

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
          <span className="item-name-button-text">{name}</span>
          {operation ? (
            <Badge className="item-name-button-badge" size="sm">
              {operation}
            </Badge>
          ) : null}
        </button>
      </div>
    </div>
  )
}
