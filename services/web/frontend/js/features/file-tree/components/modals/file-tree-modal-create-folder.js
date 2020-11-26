import React, { useState } from 'react'
import PropTypes from 'prop-types'

import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useRefWithAutoFocus } from '../../../../infrastructure/auto-focus'

import { useFileTreeActionable } from '../../contexts/file-tree-actionable'

function FileTreeModalCreateFolder() {
  const { t } = useTranslation()
  const [name, setName] = useState('')

  const {
    isCreatingFolder,
    inFlight,
    finishCreatingFolder,
    cancel,
    error
  } = useFileTreeActionable()

  if (!isCreatingFolder) return null // the modal will not be rendered; return early

  function handleHide() {
    cancel()
  }

  function handleCreateFolder() {
    finishCreatingFolder(name)
  }

  return (
    <Modal show={isCreatingFolder} onHide={handleHide}>
      <Modal.Header>
        <Modal.Title>{t('new_folder')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <InputName
          name={name}
          setName={setName}
          handleCreateFolder={handleCreateFolder}
        />
        {error && (
          <div className="alert alert-danger file-tree-modal-alert">
            {t('generic_something_went_wrong')}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        {inFlight ? (
          <Button bsStyle="primary" disabled>
            {t('creating')}…
          </Button>
        ) : (
          <>
            <Button onClick={handleHide}>{t('cancel')}</Button>
            <Button bsStyle="primary" onClick={handleCreateFolder}>
              {t('create')}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  )
}

function InputName({ name, setName, handleCreateFolder }) {
  const { autoFocusedRef } = useRefWithAutoFocus()

  function handleFocus(ev) {
    ev.target.setSelectionRange(0, -1)
  }

  function handleChange(ev) {
    setName(ev.target.value)
  }

  function handleKeyDown(ev) {
    if (ev.key === 'Enter') {
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
  handleCreateFolder: PropTypes.func.isRequired
}

export default FileTreeModalCreateFolder
