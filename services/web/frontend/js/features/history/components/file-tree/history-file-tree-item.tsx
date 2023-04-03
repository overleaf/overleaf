import type { ReactNode } from 'react'

type FileTreeItemProps = {
  name: string
  icons: ReactNode
}

export default function FileTreeItem({ name, icons }: FileTreeItemProps) {
  return (
    <div className="entity" role="presentation">
      <div className="entity-name entity-name-react" role="presentation">
        {icons}
        <button className="item-name-button">
          <span>{name}</span>
        </button>
      </div>
    </div>
  )
}
