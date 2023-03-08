import { useTranslation } from 'react-i18next'

import { MenuItem } from 'react-bootstrap'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'

function FileTreeItemMenuItems() {
  const { t } = useTranslation()

  const {
    canRename,
    canDelete,
    canCreate,
    startRenaming,
    startDeleting,
    startCreatingFolder,
    startCreatingDocOrFile,
    startUploadingDocOrFile,
    downloadPath,
  } = useFileTreeActionable()

  return (
    <>
      {canRename ? (
        <MenuItem onClick={startRenaming}>{t('rename')}</MenuItem>
      ) : null}
      {downloadPath ? (
        <MenuItem href={downloadPath} download>
          {t('download')}
        </MenuItem>
      ) : null}
      {canDelete ? (
        <MenuItem onClick={startDeleting}>{t('delete')}</MenuItem>
      ) : null}
      {canCreate ? (
        <>
          <MenuItem divider />
          <MenuItem onClick={startCreatingDocOrFile}>{t('new_file')}</MenuItem>
          <MenuItem onClick={startCreatingFolder}>{t('new_folder')}</MenuItem>
          <MenuItem onClick={startUploadingDocOrFile}>{t('upload')}</MenuItem>
        </>
      ) : null}
    </>
  )
}

export default FileTreeItemMenuItems
