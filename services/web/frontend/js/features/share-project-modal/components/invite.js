import React, { useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  useProjectContext,
  useShareProjectContext,
} from './share-project-modal'
import Icon from '../../../shared/components/icon'
import { Button, Col, Row, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { Trans } from 'react-i18next'
import MemberPrivileges from './member-privileges'
import { resendInvite, revokeInvite } from '../utils/api'

export default function Invite({ invite, isAdmin }) {
  return (
    <Row className="project-invite">
      <Col xs={7}>
        <div>{invite.email}</div>

        <div className="small">
          <Trans i18nKey="invite_not_accepted" />
          .&nbsp;
          {isAdmin && <ResendInvite invite={invite} />}
        </div>
      </Col>

      <Col xs={3} className="text-left">
        <MemberPrivileges privileges={invite.privileges} />
      </Col>

      {isAdmin && (
        <Col xs={2} className="text-center">
          <RevokeInvite invite={invite} />
        </Col>
      )}
    </Row>
  )
}

Invite.propTypes = {
  invite: PropTypes.object.isRequired,
  isAdmin: PropTypes.bool.isRequired,
}

function ResendInvite({ invite }) {
  const { monitorRequest } = useShareProjectContext()
  const project = useProjectContext()

  // const buttonRef = useRef(null)
  //
  const handleClick = useCallback(
    () =>
      monitorRequest(() => resendInvite(project, invite)).finally(() => {
        // NOTE: disabled as react-bootstrap v0.33.1 isn't forwarding the ref to the `button`
        // if (buttonRef.current) {
        //   buttonRef.current.blur()
        // }
        document.activeElement.blur()
      }),
    [invite, monitorRequest, project]
  )

  return (
    <Button
      bsStyle="link"
      className="btn-inline-link"
      onClick={handleClick}
      // ref={buttonRef}
    >
      <Trans i18nKey="resend" />
    </Button>
  )
}
ResendInvite.propTypes = {
  invite: PropTypes.object.isRequired,
}

function RevokeInvite({ invite }) {
  const { updateProject, monitorRequest } = useShareProjectContext()
  const project = useProjectContext()

  function handleClick(event) {
    event.preventDefault()

    monitorRequest(() => revokeInvite(project, invite)).then(() => {
      updateProject({
        invites: project.invites.filter(existing => existing !== invite),
      })
    })
  }

  return (
    <OverlayTrigger
      placement="bottom"
      overlay={
        <Tooltip id="tooltip-revoke-invite">
          <Trans i18nKey="revoke_invite" />
        </Tooltip>
      }
    >
      <Button
        type="button"
        bsStyle="link"
        onClick={handleClick}
        aria-label="Revoke"
        className="btn-inline-link"
      >
        <Icon type="times" />
      </Button>
    </OverlayTrigger>
  )
}
RevokeInvite.propTypes = {
  invite: PropTypes.object.isRequired,
}
