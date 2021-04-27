import React from 'react'
import { Button, Modal, Grid } from 'react-bootstrap'
import { Trans } from 'react-i18next'
import ShareModalBody from './share-modal-body'
import Icon from '../../../shared/components/icon'
import AccessibleModal from '../../../shared/components/accessible-modal'
import PropTypes from 'prop-types'
import { ReadOnlyTokenLink } from './link-sharing'

export default function ShareProjectModalContent({
  show,
  cancel,
  animation,
  inFlight,
  error,
}) {
  return (
    <AccessibleModal show={show} onHide={cancel} animation={animation}>
      <Modal.Header closeButton>
        <Modal.Title>
          <Trans i18nKey="share_project" />
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="modal-body-share">
        <Grid fluid>
          {window.isRestrictedTokenMember ? (
            <ReadOnlyTokenLink />
          ) : (
            <ShareModalBody />
          )}
        </Grid>
      </Modal.Body>

      <Modal.Footer className="modal-footer-share">
        <div className="modal-footer-left">
          {inFlight && <Icon type="refresh" spin />}
          {error && (
            <span className="text-danger error">
              <ErrorMessage error={error} />
            </span>
          )}
        </div>

        <div className="modal-footer-right">
          <Button
            type="button"
            onClick={cancel}
            bsStyle="default"
            disabled={inFlight}
          >
            <Trans i18nKey="close" />
          </Button>
        </div>
      </Modal.Footer>
    </AccessibleModal>
  )
}
ShareProjectModalContent.propTypes = {
  cancel: PropTypes.func.isRequired,
  show: PropTypes.bool,
  animation: PropTypes.bool,
  inFlight: PropTypes.bool,
  error: PropTypes.string,
}

function ErrorMessage({ error }) {
  switch (error) {
    case 'cannot_invite_non_user':
      return <Trans i18nKey="cannot_invite_non_user" />

    case 'cannot_verify_user_not_robot':
      return <Trans i18nKey="cannot_verify_user_not_robot" />

    case 'cannot_invite_self':
      return <Trans i18nKey="cannot_invite_self" />

    case 'invalid_email':
      return <Trans i18nKey="invalid_email" />

    case 'too_many_requests':
      return <Trans i18nKey="too_many_requests" />

    default:
      return <Trans i18nKey="generic_something_went_wrong" />
  }
}
ErrorMessage.propTypes = {
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]).isRequired,
}
