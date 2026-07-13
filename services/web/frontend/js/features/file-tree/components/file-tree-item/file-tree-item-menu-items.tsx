import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { useProjectContext } from '@/shared/context/project-context'

import {
  OLDropdownDivider,
  OLDropdownItem,
} from '@/shared/components/ol/ol-dropdown-menu'
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
    selectedFileName,
    canSetRootDocId,
    setRootDocId,
  } = useFileTreeActionable()

  const { project } = useProjectContext()
  const projectOwner = project?.owner?._id

  const downloadWithAnalytics = useCallback(() => {
    // we are only interested in downloads of bib files WRT analytics, for the purposes of promoting the tpr integrations
    if (selectedFileName?.endsWith('.bib')) {
      eventTracking.sendMB('download-bib-file', { projectOwner })
    }
  }, [selectedFileName, projectOwner])

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
        <li role="none">
          <OLDropdownItem onClick={startRenaming}>{t('rename')}</OLDropdownItem>
        </li>
      ) : null}
      {downloadPath ? (
        <li role="none">
          <OLDropdownItem
            href={downloadPath}
            onClick={downloadWithAnalytics}
            download={selectedFileName ?? undefined}
          >
            {t('download')}
          </OLDropdownItem>
        </li>
      ) : null}
      {canSetRootDocId ? (
        <>
          <OLDropdownDivider />
          <li role="none">
            <OLDropdownItem onClick={setRootDocId}>
              {t('set_as_main_document')}
            </OLDropdownItem>
          </li>
        </>
      ) : null}
      {canDelete ? (
        <>
          <OLDropdownDivider />
          <li role="none">
            <OLDropdownItem onClick={startDeleting}>
              {t('delete')}
            </OLDropdownItem>
          </li>
        </>
      ) : null}
      {canCreate ? (
        <>
          <OLDropdownDivider />
          <li role="none">
            <OLDropdownItem onClick={createWithAnalytics}>
              {t('new_file')}
            </OLDropdownItem>
          </li>
          <li role="none">
            <OLDropdownItem onClick={startCreatingFolder}>
              {t('new_folder')}
            </OLDropdownItem>
          </li>
          <li role="none">
            <OLDropdownItem onClick={uploadWithAnalytics}>
              {t('upload')}
            </OLDropdownItem>
          </li>
        </>
      ) : null}
    </>
  )
}

export default FileTreeItemMenuItems
