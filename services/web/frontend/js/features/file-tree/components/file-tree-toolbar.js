import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import { Button } from 'react-bootstrap'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'

import { useEditorContext } from '../../../shared/context/editor-context'
import { useFileTreeActionable } from '../contexts/file-tree-actionable'

function FileTreeToolbar() {
  const { permissionsLevel } = useEditorContext(editorContextPropTypes)

  if (permissionsLevel === 'readOnly') return null

  return (
    <div className="toolbar toolbar-filetree">
      <FileTreeToolbarLeft />
      <FileTreeToolbarRight />
    </div>
  )
}

const editorContextPropTypes = {
  permissionsLevel: PropTypes.oneOf(['readOnly', 'readAndWrite', 'owner']),
}

function FileTreeToolbarLeft() {
  const { t } = useTranslation()
  const {
    canCreate,
    startCreatingFolder,
    startCreatingDocOrFile,
    startUploadingDocOrFile,
  } = useFileTreeActionable()

  if (!canCreate) return null

  return (
    <div className="toolbar-left">
      <Tooltip
        id="new-file"
        description={t('new_file')}
        overlayProps={{ placement: 'bottom' }}
      >
        <Button onClick={startCreatingDocOrFile} bsStyle={null}>
          <Icon type="file" fw accessibilityLabel={t('new_file')} />
        </Button>
      </Tooltip>
      <Tooltip
        id="new-folder"
        description={t('new_folder')}
        overlayProps={{ placement: 'bottom' }}
      >
        <Button onClick={startCreatingFolder} bsStyle={null}>
          <Icon type="folder" fw accessibilityLabel={t('new_folder')} />
        </Button>
      </Tooltip>
      <Tooltip
        id="upload"
        description={t('upload')}
        overlayProps={{ placement: 'bottom' }}
      >
        <Button onClick={startUploadingDocOrFile}>
          <Icon type="upload" fw accessibilityLabel={t('upload')} />
        </Button>
      </Tooltip>
    </div>
  )
}

function FileTreeToolbarRight() {
  const { t } = useTranslation()
  const { canRename, canDelete, startRenaming, startDeleting } =
    useFileTreeActionable()

  if (!canRename && !canDelete) {
    return null
  }

  return (
    <div className="toolbar-right">
      {canRename ? (
        <Tooltip
          id="rename"
          description={t('rename')}
          overlayProps={{ placement: 'bottom' }}
        >
          <Button onClick={startRenaming}>
            <Icon type="pencil" fw accessibilityLabel={t('rename')} />
          </Button>
        </Tooltip>
      ) : null}
      {canDelete ? (
        <Tooltip
          id="delete"
          description={t('delete')}
          overlayProps={{ placement: 'bottom' }}
        >
          <Button onClick={startDeleting}>
            <Icon type="trash-o" fw accessibilityLabel={t('delete')} />
          </Button>
        </Tooltip>
      ) : null}
    </div>
  )
}

export default FileTreeToolbar
