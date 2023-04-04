import HistoryFileTreeItem from './history-file-tree-item'
import iconTypeFromName from '../../../file-tree/util/icon-type-from-name'
import Icon from '../../../../shared/components/icon'
import { useSelectableEntity } from '../../context/history-file-tree-selectable'
import { DiffOperation } from '../../services/types/file-tree'

type HistoryFileTreeDocProps = {
  name: string
  id: string
  operation?: DiffOperation
}

export default function HistoryFileTreeDoc({
  name,
  id,
  operation,
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
        operation={operation}
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
