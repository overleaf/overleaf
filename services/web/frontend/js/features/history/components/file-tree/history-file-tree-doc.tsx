import HistoryFileTreeItem from './history-file-tree-item'
import iconTypeFromName from '../../../file-tree/util/icon-type-from-name'
import Icon from '../../../../shared/components/icon'
import { useFileTreeItemSelection } from '../../context/hooks/use-file-tree-item-selection'
import { DiffOperation } from '../../services/types/diff-operation'
import classNames from 'classnames'

type HistoryFileTreeDocProps = {
  name: string
  pathname: string
  operation?: DiffOperation
}

export default function HistoryFileTreeDoc({
  name,
  pathname,
  operation,
}: HistoryFileTreeDocProps) {
  const { isSelected, onClick } = useFileTreeItemSelection(pathname)

  return (
    <li
      role="treeitem"
      className={classNames({ selected: isSelected })}
      onClick={onClick}
      onKeyDown={onClick}
      aria-selected={isSelected}
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
