import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'

import AccessibleModal from '../../../../shared/components/accessible-modal'

import { useFileTreeActionable } from '../../contexts/file-tree-actionable'

import { DuplicateFilenameError } from '../../errors'

import { isCleanFilename } from '../../util/safe-path'

function FileTreeModalCreateFolder() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [validName, setValidName] = useState(true)

  const { isCreatingFolder, inFlight, finishCreatingFolder, cancel, error } =
    useFileTreeActionable()

  useEffect(() => {
    if (!isCreatingFolder) {
      // clear the input when the modal is closed
      setName('')
    }
  }, [isCreatingFolder])

  if (!isCreatingFolder) return null // the modal will not be rendered; return early

  function handleHide() {
    cancel()
  }

  function handleCreateFolder() {
    finishCreatingFolder(name)
  }

  function errorMessage() {
    switch (error.constructor) {
      case DuplicateFilenameError:
        return t('file_already_exists')
      default:
        return t('generic_something_went_wrong')
    }
  }

  return (
    <AccessibleModal show onHide={handleHide}>
      <Modal.Header>
        <Modal.Title>{t('new_folder')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <InputName
          name={name}
          setName={setName}
          validName={validName}
          setValidName={setValidName}
          handleCreateFolder={handleCreateFolder}
        />
        {!validName ? (
          <div
            role="alert"
            aria-label={t('files_cannot_include_invalid_characters')}
            className="alert alert-danger file-tree-modal-alert"
          >
            {t('files_cannot_include_invalid_characters')}
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            aria-label={errorMessage()}
            className="alert alert-danger file-tree-modal-alert"
          >
            {errorMessage()}
          </div>
        ) : null}
      </Modal.Body>

      <Modal.Footer>
        {inFlight ? (
          <Button bsStyle="primary" disabled>
            {t('creating')}…
          </Button>
        ) : (
          <>
            <Button
              bsStyle={null}
              className="btn-secondary"
              onClick={handleHide}
            >
              {t('cancel')}
            </Button>
            <Button
              bsStyle="primary"
              onClick={handleCreateFolder}
              disabled={!validName}
            >
              {t('create')}
            </Button>
          </>
        )}
      </Modal.Footer>
    </AccessibleModal>
  )
}

function InputName({
  name,
  setName,
  validName,
  setValidName,
  handleCreateFolder,
}) {
  const { autoFocusedRef } = useRefWithAutoFocus()

  function handleFocus(ev) {
    ev.target.setSelectionRange(0, -1)
  }

  function handleChange(ev) {
    setValidName(isCleanFilename(ev.target.value.trim()))
    setName(ev.target.value)
  }

  function handleKeyDown(ev) {
    if (ev.key === 'Enter' && validName) {
      handleCreateFolder()
    }
  }

  return (
    <input
      ref={autoFocusedRef}
      className="form-control"
      type="text"
      value={name}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      onFocus={handleFocus}
    />
  )
}

InputName.propTypes = {
  name: PropTypes.string.isRequired,
  setName: PropTypes.func.isRequired,
  validName: PropTypes.bool.isRequired,
  setValidName: PropTypes.func.isRequired,
  handleCreateFolder: PropTypes.func.isRequired,
}

export default FileTreeModalCreateFolder
