import React from 'react'
import PropTypes from 'prop-types'
import { Trans } from 'react-i18next'
import {
  Modal,
  Alert,
  Button,
  ControlLabel,
  FormControl,
  FormGroup
} from 'react-bootstrap'
import AccessibleModal from '../../../shared/components/accessible-modal'

export default function CloneProjectModalContent({
  animation = true,
  show,
  cancel,
  handleSubmit,
  clonedProjectName,
  setClonedProjectName,
  error,
  inFlight,
  valid
}) {
  return (
    <AccessibleModal
      animation={animation}
      show={show}
      onHide={cancel}
      id="clone-project-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <Trans i18nKey="copy_project" />
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <form id="clone-project-form" onSubmit={handleSubmit}>
          <FormGroup>
            <ControlLabel htmlFor="clone-project-form-name">
              <Trans i18nKey="new_name" />
            </ControlLabel>

            <FormControl
              id="clone-project-form-name"
              type="text"
              placeholder="New Project Name"
              required
              value={clonedProjectName}
              onChange={event => setClonedProjectName(event.target.value)}
            />
          </FormGroup>
        </form>

        {error && (
          <Alert bsStyle="danger">
            {error.length ? (
              error
            ) : (
              <Trans i18nKey="generic_something_went_wrong" />
            )}
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button type="button" disabled={inFlight} onClick={cancel}>
          <Trans i18nKey="cancel" />
        </Button>

        <Button
          form="clone-project-form"
          type="submit"
          bsStyle="primary"
          disabled={inFlight || !valid}
        >
          {inFlight ? (
            <>
              <Trans i18nKey="copying" />…
            </>
          ) : (
            <Trans i18nKey="copy" />
          )}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}
CloneProjectModalContent.propTypes = {
  animation: PropTypes.bool,
  show: PropTypes.bool.isRequired,
  cancel: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  clonedProjectName: PropTypes.string,
  setClonedProjectName: PropTypes.func.isRequired,
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  inFlight: PropTypes.bool.isRequired,
  valid: PropTypes.bool.isRequired
}
