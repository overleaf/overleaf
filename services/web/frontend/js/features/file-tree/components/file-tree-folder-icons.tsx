import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

function FileTreeFolderIcons({
  expanded,
  onExpandCollapseClick,
}: {
  expanded: boolean
  onExpandCollapseClick?: () => void
}) {
  const { t } = useTranslation()
  const newEditor = useIsNewEditorEnabled()

  if (newEditor) {
    return (
      <>
        <div
          // TODO ide-redesign-cleanup: rename the class now its no longer a button
          className="folder-expand-collapse-button"
          aria-label={expanded ? t('collapse') : t('expand')}
        >
          <MaterialIcon
            type={expanded ? 'expand_more' : 'chevron_right'}
            className="file-tree-expand-icon"
          />
        </div>
      </>
    )
  }

  return (
    <>
      <button
        onClick={onExpandCollapseClick}
        aria-label={expanded ? t('collapse') : t('expand')}
      >
        <MaterialIcon
          type={expanded ? 'expand_more' : 'chevron_right'}
          className="file-tree-expand-icon"
        />
      </button>
      <MaterialIcon
        type={expanded ? 'folder_open' : 'folder'}
        className="file-tree-folder-icon"
      />
    </>
  )
}

export default FileTreeFolderIcons
