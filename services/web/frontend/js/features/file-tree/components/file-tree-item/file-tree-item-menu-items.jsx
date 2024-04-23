import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { useProjectContext } from '@/shared/context/project-context'

import { MenuItem } from 'react-bootstrap'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useFileTreeSelectable } from '../../contexts/file-tree-selectable'
import { findInTree } from '../../util/find-in-tree'

function FileTreeItemMenuItems() {
  const { t } = useTranslation()

  const { fileTreeData } = useFileTreeData()
  const { selectedEntityIds } = useFileTreeSelectable()

  // return the name of the selected file or doc if there is only one selected
  const selectedFileName = useMemo(() => {
    if (selectedEntityIds.size === 1) {
      const [selectedEntityId] = selectedEntityIds
      const selectedEntity = findInTree(fileTreeData, selectedEntityId)
      return selectedEntity?.entity?.name
    }
    return null
  }, [fileTreeData, selectedEntityIds])

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

  const { owner } = useProjectContext()

  const downloadWithAnalytics = useCallback(() => {
    // we are only interested in downloads of bib files WRT analytics, for the purposes of promoting the tpr integrations
    if (selectedFileName?.endsWith('.bib')) {
      eventTracking.sendMB('download-bib-file', { projectOwner: owner._id })
    }
  }, [selectedFileName, owner])

  const createWithAnalytics = useCallback(() => {
    eventTracking.sendMB('new-file-click', { location: 'file-menu' })
    startCreatingDocOrFile()
  }, [startCreatingDocOrFile])

  const uploadWithAnalytics = useCallback(() => {
    eventTracking.sendMB('upload-click', { location: 'file-menu' })
    startUploadingDocOrFile()
  }, [startUploadingDocOrFile])

  return (
    <>
      {canRename ? (
        <MenuItem onClick={startRenaming}>{t('rename')}</MenuItem>
      ) : null}
      {downloadPath ? (
        <MenuItem href={downloadPath} onClick={downloadWithAnalytics} download>
          {t('download')}
        </MenuItem>
      ) : null}
      {canDelete ? (
        <MenuItem onClick={startDeleting}>{t('delete')}</MenuItem>
      ) : null}
      {canCreate ? (
        <>
          <MenuItem divider />
          <MenuItem onClick={createWithAnalytics}>{t('new_file')}</MenuItem>
          <MenuItem onClick={startCreatingFolder}>{t('new_folder')}</MenuItem>
          <MenuItem onClick={uploadWithAnalytics}>{t('upload')}</MenuItem>
        </>
      ) : null}
    </>
  )
}

export default FileTreeItemMenuItems
