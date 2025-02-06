import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { useFileTreeActionable } from '@/features/file-tree/contexts/file-tree-actionable'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon, {
  AvailableUnfilledIcon,
} from '@/shared/components/material-icon'
import React from 'react'
import useCollapsibleFileTree from '../hooks/use-collapsible-file-tree'

function FileTreeToolbar() {
  const { t } = useTranslation()
  const { fileTreeExpanded, toggleFileTreeExpanded } = useCollapsibleFileTree()

  return (
    <div className="file-tree-toolbar">
      <button
        className="file-tree-expand-collapse-button"
        onClick={toggleFileTreeExpanded}
        aria-label={
          fileTreeExpanded ? t('hide_file_tree') : t('show_file_tree')
        }
      >
        <MaterialIcon
          type={
            fileTreeExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'
          }
        />
        <h4>{t('file_tree')}</h4>
      </button>
      <FileTreeActionButtons />
    </div>
  )
}

function FileTreeActionButtons() {
  const { t } = useTranslation()
  const { fileTreeReadOnly } = useFileTreeData()

  const {
    canCreate,
    startCreatingFolder,
    startCreatingDocOrFile,
    startUploadingDocOrFile,
  } = useFileTreeActionable()

  if (!canCreate || fileTreeReadOnly) return null

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
      <FileTreeActionButton
        id="new-file"
        description={t('new_file')}
        onClick={createWithAnalytics}
        iconType="note_add"
      />
      <FileTreeActionButton
        id="new-folder"
        description={t('new_folder')}
        onClick={startCreatingFolder}
        iconType="create_new_folder"
      />
      <FileTreeActionButton
        id="upload"
        description={t('upload')}
        onClick={uploadWithAnalytics}
        iconType="upload_file"
      />
    </div>
  )
}

function FileTreeActionButton({
  id,
  description,
  onClick,
  iconType,
}: {
  id: string
  description: string
  onClick: () => void
  iconType: AvailableUnfilledIcon
}) {
  return (
    <OLTooltip
      id={id}
      description={description}
      overlayProps={{ placement: 'bottom' }}
    >
      <button className="btn file-tree-toolbar-action-button" onClick={onClick}>
        <MaterialIcon
          unfilled
          type={iconType}
          accessibilityLabel={description}
        />
      </button>
    </OLTooltip>
  )
}

export default FileTreeToolbar
