import { memo } from 'react'
import classNames from 'classnames'
import HistoryFileTreeItem from './history-file-tree-item'
import iconTypeFromName, {
  newEditorIconTypeFromName,
} from '../../../file-tree/util/icon-type-from-name'
import type { FileDiff } from '../../services/types/file'
import MaterialIcon from '@/shared/components/material-icon'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

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
  const newEditor = useIsNewEditorEnabled()
  const icon = newEditor ? (
    <MaterialIcon
      unfilled
      type={newEditorIconTypeFromName(name)}
      className="file-tree-icon"
    />
  ) : (
    <MaterialIcon type={iconTypeFromName(name)} className="file-tree-icon" />
  )
  return (
    <li
      role="treeitem"
      className={classNames({ selected })}
      onClick={e => onClick(file, e)}
      onKeyDown={e => onKeyDown(file, e)}
      aria-selected={selected}
      aria-label={name}
      tabIndex={0}
      translate="no"
    >
      <HistoryFileTreeItem
        name={name}
        operation={'operation' in file ? file.operation : undefined}
        icons={icon}
      />
    </li>
  )
}

export default memo(HistoryFileTreeDoc)
