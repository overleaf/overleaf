import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { useProjectContext } from '@/shared/context/project-context'

import {
  DropdownDivider,
  DropdownItem,
} from '@/shared/components/dropdown/dropdown-menu'
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
          <DropdownItem onClick={startRenaming}>{t('rename')}</DropdownItem>
        </li>
      ) : null}
      {downloadPath ? (
        <li role="none">
          <DropdownItem
            href={downloadPath}
            onClick={downloadWithAnalytics}
            download={selectedFileName ?? undefined}
          >
            {t('download')}
          </DropdownItem>
        </li>
      ) : null}
      {canSetRootDocId ? (
        <>
          <DropdownDivider />
          <li role="none">
            <DropdownItem onClick={setRootDocId}>
              {t('set_as_main_document')}
            </DropdownItem>
          </li>
        </>
      ) : null}
      {canDelete ? (
        <>
          <DropdownDivider />
          <li role="none">
            <DropdownItem onClick={startDeleting}>{t('delete')}</DropdownItem>
          </li>
        </>
      ) : null}
      {canCreate ? (
        <>
          <DropdownDivider />
          <li role="none">
            <DropdownItem onClick={createWithAnalytics}>
              {t('new_file')}
            </DropdownItem>
          </li>
          <li role="none">
            <DropdownItem onClick={startCreatingFolder}>
              {t('new_folder')}
            </DropdownItem>
          </li>
          <li role="none">
            <DropdownItem onClick={uploadWithAnalytics}>
              {t('upload')}
            </DropdownItem>
          </li>
        </>
      ) : null}
    </>
  )
}

export default FileTreeItemMenuItems
