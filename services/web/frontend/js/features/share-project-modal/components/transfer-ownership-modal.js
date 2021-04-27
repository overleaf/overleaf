import React, { useState } from 'react'
import { Modal, Button } from 'react-bootstrap'
import { Trans } from 'react-i18next'
import PropTypes from 'prop-types'
import { useProjectContext } from './share-project-modal'
import Icon from '../../../shared/components/icon'
import { transferProjectOwnership } from '../utils/api'
import AccessibleModal from '../../../shared/components/accessible-modal'
import { reload } from '../utils/location'

export default function TransferOwnershipModal({ member, cancel }) {
  const [inflight, setInflight] = useState(false)
  const [error, setError] = useState(false)

  const project = useProjectContext()

  function confirm() {
    setError(false)
    setInflight(true)

    transferProjectOwnership(project, member)
      .then(() => {
        reload()
      })
      .catch(() => {
        setError(true)
        setInflight(false)
      })
  }

  return (
    <AccessibleModal show onHide={cancel}>
      <Modal.Header closeButton>
        <Modal.Title>
          <Trans i18nKey="change_project_owner" />
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          <Trans
            i18nKey="project_ownership_transfer_confirmation_1"
            values={{ user: member.email, project: project.name }}
            components={[<strong key="strong-1" />, <strong key="strong-2" />]}
          />
        </p>
        <p>
          <Trans i18nKey="project_ownership_transfer_confirmation_2" />
        </p>
      </Modal.Body>
      <Modal.Footer>
        <div className="modal-footer-left">
          {inflight && <Icon type="refresh" spin />}
          {error && (
            <span className="text-danger">
              <Trans i18nKey="generic_something_went_wrong" />
            </span>
          )}
        </div>
        <div className="modal-footer-right">
          <Button
            type="button"
            bsStyle="default"
            onClick={cancel}
            disabled={inflight}
          >
            <Trans i18nKey="cancel" />
          </Button>
          <Button
            type="button"
            bsStyle="success"
            onClick={confirm}
            disabled={inflight}
          >
            <Trans i18nKey="change_owner" />
          </Button>
        </div>
      </Modal.Footer>
    </AccessibleModal>
  )
}
TransferOwnershipModal.propTypes = {
  member: PropTypes.object.isRequired,
  cancel: PropTypes.func.isRequired,
}
