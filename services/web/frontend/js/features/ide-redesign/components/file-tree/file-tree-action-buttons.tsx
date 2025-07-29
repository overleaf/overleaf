import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { useFileTreeActionable } from '@/features/file-tree/contexts/file-tree-actionable'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import React from 'react'
import { useCommandProvider } from '@/features/ide-react/hooks/use-command-provider'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import FileTreeActionButton from './file-tree-action-button'
import { useRailContext } from '../../contexts/rail-context'

export default function FileTreeActionButtons({
  fileTreeExpanded,
}: {
  fileTreeExpanded: boolean
}) {
  const { t } = useTranslation()
  const { fileTreeReadOnly } = useFileTreeData()
  const { write } = usePermissionsContext()
  const { handlePaneCollapse } = useRailContext()

  const {
    canCreate,
    canBulkDelete,
    startDeleting,
    startCreatingFolder,
    startCreatingDocOrFile,
    startUploadingDocOrFile,
  } = useFileTreeActionable()

  useCommandProvider(() => {
    if (!canCreate || fileTreeReadOnly || !write) return
    return [
      {
        label: t('new_file'),
        id: 'new_file',
        handler: ({ location }) => {
          eventTracking.sendMB('new-file-click', { location })
          startCreatingDocOrFile()
        },
      },
      {
        label: t('new_folder'),
        id: 'new_folder',
        handler: startCreatingFolder,
      },
      {
        label: t('upload_file'),
        id: 'upload_file',
        handler: ({ location }) => {
          eventTracking.sendMB('upload-click', { location })
          startUploadingDocOrFile()
        },
      },
    ]
  }, [
    canCreate,
    fileTreeReadOnly,
    startCreatingDocOrFile,
    t,
    startCreatingFolder,
    startUploadingDocOrFile,
    write,
  ])

  if (fileTreeReadOnly) return null

  const createWithAnalytics = () => {
    eventTracking.sendMB('new-file-click', { location: 'toolbar' })
    startCreatingDocOrFile()
  }

  const uploadWithAnalytics = () => {
    eventTracking.sendMB('upload-click', { location: 'toolbar' })
    startUploadingDocOrFile()
  }

  return (
    <div className="file-tree-toolbar-action-buttons">
      {fileTreeExpanded && (
        <>
          {canCreate && (
            <FileTreeActionButton
              id="new-file"
              description={t('new_file')}
              onClick={createWithAnalytics}
              iconType="note_add"
            />
          )}
          {canCreate && (
            <FileTreeActionButton
              id="new-folder"
              description={t('new_folder')}
              onClick={startCreatingFolder}
              iconType="create_new_folder"
            />
          )}
          {canCreate && (
            <FileTreeActionButton
              id="upload"
              description={t('upload')}
              onClick={uploadWithAnalytics}
              iconType="upload"
            />
          )}
          {canBulkDelete && (
            <FileTreeActionButton
              id="delete"
              description={t('delete')}
              onClick={startDeleting}
              iconType="delete"
            />
          )}
        </>
      )}
      <FileTreeActionButton
        id="close"
        description={t('close')}
        onClick={handlePaneCollapse}
        iconType="close"
      />
    </div>
  )
}
