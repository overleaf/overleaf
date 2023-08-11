import { useState, memo } from 'react'
import { useTranslation } from 'react-i18next'

import HistoryFileTreeItem from './history-file-tree-item'
import HistoryFileTreeFolderList from './history-file-tree-folder-list'

import Icon from '../../../../shared/components/icon'
import type { HistoryDoc, HistoryFileTree } from '../../utils/file-tree'

type HistoryFileTreeFolderProps = {
  name: string
  folders: HistoryFileTree[]
  docs: HistoryDoc[]
}

function HistoryFileTreeFolder({
  name,
  folders,
  docs,
}: HistoryFileTreeFolderProps) {
  const { t } = useTranslation()

  const [expanded, setExpanded] = useState(true)

  const icons = (
    <>
      <button
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? t('collapse') : t('expand')}
        className="history-file-tree-folder-button"
      >
        <Icon
          type={expanded ? 'angle-down' : 'angle-right'}
          fw
          className="file-tree-expand-icon"
        />
      </button>
      <Icon
        type={expanded ? 'folder-open' : 'folder'}
        fw
        className="file-tree-folder-icon"
      />
    </>
  )

  return (
    <>
      <li
        // FIXME
        // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
        role="treeitem"
        aria-expanded={expanded}
        aria-label={name}
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={() => setExpanded(!expanded)}
      >
        <HistoryFileTreeItem name={name} icons={icons} />
      </li>
      {expanded ? (
        <HistoryFileTreeFolderList folders={folders} docs={docs} />
      ) : null}
    </>
  )
}

export default memo(HistoryFileTreeFolder)
