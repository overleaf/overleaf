import { Button, Modal } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'

import { useFileTreeActionable } from '../../contexts/file-tree-actionable'

import {
  InvalidFilenameError,
  BlockedFilenameError,
  DuplicateFilenameError,
  DuplicateFilenameMoveError,
} from '../../errors'

function FileTreeModalError() {
  const { t } = useTranslation()

  const { isRenaming, isMoving, cancel, error } = useFileTreeActionable()

  // the modal will not be rendered; return early
  if (!error) return null
  if (!isRenaming && !isMoving) return null

  function handleHide() {
    cancel()
  }

  function errorTitle() {
    switch (error.constructor) {
      case DuplicateFilenameError:
      case DuplicateFilenameMoveError:
        return t('duplicate_file')
      case InvalidFilenameError:
      case BlockedFilenameError:
        return t('invalid_file_name')
      default:
        return t('error')
    }
  }

  function errorMessage() {
    switch (error.constructor) {
      case DuplicateFilenameError:
        return t('file_already_exists')
      case DuplicateFilenameMoveError:
        return (
          <Trans
            i18nKey="file_already_exists_in_this_location"
            components={[<strong />]} // eslint-disable-line react/jsx-key
            values={{ fileName: error.entityName }}
          />
        )
      case InvalidFilenameError:
        return t('files_cannot_include_invalid_characters')
      case BlockedFilenameError:
        return t('blocked_filename')
      default:
        return t('generic_something_went_wrong')
    }
  }

  return (
    <Modal show onHide={handleHide}>
      <Modal.Header>
        <Modal.Title>{errorTitle()}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div role="alert" aria-label={errorMessage()}>
          {errorMessage()}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={handleHide} bsStyle="primary">
          {t('ok')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default FileTreeModalError
