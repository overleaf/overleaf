import React from 'react'

import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

import { useFileTreeActionable } from '../../contexts/file-tree-actionable'

import { InvalidFilenameError, DuplicateFilenameError } from '../../errors'

function FileTreeModalError() {
  const { t } = useTranslation()

  const { isRenaming, cancel, error } = useFileTreeActionable()

  if (!isRenaming || !error) return null // the modal will not be rendered; return early

  function handleHide() {
    cancel()
  }

  function errorTitle() {
    switch (error.constructor) {
      case DuplicateFilenameError:
        return t('duplicate_file')
      case InvalidFilenameError:
        return t('invalid_file_name')
      default:
        return t('error')
    }
  }

  function errorMessage() {
    switch (error.constructor) {
      case DuplicateFilenameError:
        return t('file_already_exists')
      case InvalidFilenameError:
        return t('files_cannot_include_invalid_characters')
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
        <Button onClick={handleHide}>{t('ok')}</Button>
      </Modal.Footer>
    </Modal>
  )
}

export default FileTreeModalError
