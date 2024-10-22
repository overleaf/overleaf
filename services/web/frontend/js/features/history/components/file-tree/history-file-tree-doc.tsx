import { memo } from 'react'
import classNames from 'classnames'
import HistoryFileTreeItem from './history-file-tree-item'
import iconTypeFromName from '../../../file-tree/util/icon-type-from-name'
import Icon from '../../../../shared/components/icon'
import type { FileDiff } from '../../services/types/file'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'

type HistoryFileTreeDocProps = {
  file: FileDiff
  name: string
  selected: boolean
  onClick: (file: FileDiff, event: React.MouseEvent<HTMLLIElement>) => void
  onKeyDown: (file: FileDiff, event: React.KeyboardEvent<HTMLLIElement>) => void
}

function HistoryFileTreeDoc({
  file,
  name,
  selected,
  onClick,
  onKeyDown,
}: HistoryFileTreeDocProps) {
  return (
    <li
      role="treeitem"
      className={classNames({ selected })}
      onClick={e => onClick(file, e)}
      onKeyDown={e => onKeyDown(file, e)}
      aria-selected={selected}
      aria-label={name}
      tabIndex={0}
    >
      <HistoryFileTreeItem
        name={name}
        operation={'operation' in file ? file.operation : undefined}
        icons={
          <BootstrapVersionSwitcher
            bs3={
              <Icon
                type={iconTypeFromName(name)}
                fw
                className="file-tree-icon"
              />
            }
            bs5={
              <MaterialIcon
                type={iconTypeFromName(name)}
                className="file-tree-icon"
              />
            }
          />
        }
      />
    </li>
  )
}

export default memo(HistoryFileTreeDoc)
