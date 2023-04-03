import HistoryFileTreeItem from './history-file-tree-item'
import iconTypeFromName from '../../../file-tree/util/icon-type-from-name'
import Icon from '../../../../shared/components/icon'
import { useSelectableEntity } from '../../context/history-file-tree-selectable'

type HistoryFileTreeDocProps = {
  name: string
  id: string
}

export default function HistoryFileTreeDoc({
  name,
  id,
}: HistoryFileTreeDocProps) {
  const { props: selectableEntityProps } = useSelectableEntity(id)

  return (
    <li
      role="treeitem"
      {...selectableEntityProps}
      aria-label={name}
      tabIndex={0}
    >
      <HistoryFileTreeItem
        name={name}
        icons={
          <Icon
            type={iconTypeFromName(name)}
            fw
            className="spaced file-tree-icon"
          />
        }
      />
    </li>
  )
}
