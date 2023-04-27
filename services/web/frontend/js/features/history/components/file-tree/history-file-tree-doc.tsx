import classNames from 'classnames'
import HistoryFileTreeItem from './history-file-tree-item'
import iconTypeFromName from '../../../file-tree/util/icon-type-from-name'
import Icon from '../../../../shared/components/icon'
import { useFileTreeItemSelection } from '../../context/hooks/use-file-tree-item-selection'
import type { FileDiff } from '../../services/types/file'

type HistoryFileTreeDocProps = {
  file: FileDiff
  name: string
}

export default function HistoryFileTreeDoc({
  file,
  name,
}: HistoryFileTreeDocProps) {
  const { isSelected, onClick } = useFileTreeItemSelection(file)

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
        operation={'operation' in file ? file.operation : undefined}
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
