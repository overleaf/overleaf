import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function FileTreeFolderIcons({
  expanded,
  onExpandCollapseClick,
}: {
  expanded: boolean
  onExpandCollapseClick: () => void
}) {
  const { t } = useTranslation()

  const newEditor = useFeatureFlag('editor-redesign')

  if (newEditor) {
    return (
      <>
        <button
          className="folder-expand-collapse-button"
          onClick={onExpandCollapseClick}
          aria-label={expanded ? t('collapse') : t('expand')}
        >
          <MaterialIcon
            type={expanded ? 'expand_more' : 'chevron_right'}
            className="file-tree-expand-icon"
          />
        </button>
      </>
    )
  }

  return (
    <BootstrapVersionSwitcher
      bs3={
        <>
          <button
            onClick={onExpandCollapseClick}
            aria-label={expanded ? t('collapse') : t('expand')}
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
      }
      bs5={
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
      }
    />
  )
}

export default FileTreeFolderIcons
