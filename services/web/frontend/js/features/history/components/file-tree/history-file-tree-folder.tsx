import { useState, memo } from 'react'
import { useTranslation } from 'react-i18next'

import HistoryFileTreeItem from './history-file-tree-item'
import HistoryFileTreeFolderList from './history-file-tree-folder-list'

import type { HistoryDoc, HistoryFileTree } from '../../utils/file-tree'
import MaterialIcon from '@/shared/components/material-icon'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

type HistoryFileTreeFolderProps = {
  name: string
  folders: HistoryFileTree[]
  docs: HistoryDoc[]
}

function hasChanges(fileTree: HistoryFileTree): boolean {
  const hasSameLevelChanges = fileTree.docs?.some(
    (doc: HistoryDoc) => (doc as any).operation !== undefined
  )
  if (hasSameLevelChanges) {
    return true
  }
  const hasNestedChanges = fileTree.folders?.some(folder => {
    return hasChanges(folder)
  })
  if (hasNestedChanges) {
    return true
  }
  return false
}

function HistoryFileTreeFolder({
  name,
  folders,
  docs,
}: HistoryFileTreeFolderProps) {
  const { t } = useTranslation()
  const newEditor = useIsNewEditorEnabled()

  const [expanded, setExpanded] = useState(() => {
    return hasChanges({ name, folders, docs })
  })

  const icons = (
    <>
      <button
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? t('collapse') : t('expand')}
        className="history-file-tree-folder-button"
      >
        <MaterialIcon
          type={expanded ? 'expand_more' : 'chevron_right'}
          className="file-tree-expand-icon"
        />
      </button>
      {!newEditor && (
        <MaterialIcon
          type={expanded ? 'folder_open' : 'folder'}
          className="file-tree-folder-icon"
        />
      )}
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
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setExpanded(!expanded)
          }
        }}
        translate="no"
      >
        <HistoryFileTreeItem name={name} icons={icons} />
      </li>
      {expanded ? (
        <HistoryFileTreeFolderList
          folders={folders}
          docs={docs}
          rootClassName="history-file-tree-list-inner"
        />
      ) : null}
    </>
  )
}

export default memo(HistoryFileTreeFolder)
