import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

function FileTreeFolderIcons({ expanded }: { expanded: boolean }) {
  const { t } = useTranslation()

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

export default FileTreeFolderIcons
