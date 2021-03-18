import React from 'react'
import { useTranslation } from 'react-i18next'

import Icon from '../../../shared/components/icon'
import TooltipButton from '../../../shared/components/tooltip-button'

import { useFileTreeMainContext } from '../contexts/file-tree-main'
import { useFileTreeActionable } from '../contexts/file-tree-actionable'

function FileTreeToolbar() {
  const { hasWritePermissions } = useFileTreeMainContext()

  if (!hasWritePermissions) return null

  return (
    <div className="toolbar toolbar-filetree">
      <FileTreeToolbarLeft />
      <FileTreeToolbarRight />
    </div>
  )
}

function FileTreeToolbarLeft() {
  const { t } = useTranslation()
  const {
    canCreate,
    startCreatingFolder,
    startCreatingDocOrFile,
    startUploadingDocOrFile
  } = useFileTreeActionable()

  if (!canCreate) return null

  return (
    <div className="toolbar-left">
      <TooltipButton
        id="new_file"
        description={t('new_file')}
        onClick={startCreatingDocOrFile}
      >
        <Icon type="file" modifier="fw" accessibilityLabel={t('new_file')} />
      </TooltipButton>
      <TooltipButton
        id="new_folder"
        description={t('new_folder')}
        onClick={startCreatingFolder}
      >
        <Icon
          type="folder"
          modifier="fw"
          accessibilityLabel={t('new_folder')}
        />
      </TooltipButton>
      <TooltipButton
        id="upload"
        description={t('upload')}
        onClick={startUploadingDocOrFile}
      >
        <Icon type="upload" modifier="fw" accessibilityLabel={t('upload')} />
      </TooltipButton>
    </div>
  )
}

function FileTreeToolbarRight() {
  const { t } = useTranslation()
  const {
    canRename,
    canDelete,
    startRenaming,
    startDeleting
  } = useFileTreeActionable()

  if (!canRename && !canDelete) {
    return null
  }

  return (
    <div className="toolbar-right">
      {canRename ? (
        <TooltipButton
          id="rename"
          description={t('rename')}
          onClick={startRenaming}
        >
          <Icon type="pencil" modifier="fw" accessibilityLabel={t('rename')} />
        </TooltipButton>
      ) : null}
      {canDelete ? (
        <TooltipButton
          id="delete"
          description={t('delete')}
          onClick={startDeleting}
        >
          <Icon type="trash-o" modifier="fw" accessibilityLabel={t('delete')} />
        </TooltipButton>
      ) : null}
    </div>
  )
}

export default FileTreeToolbar
