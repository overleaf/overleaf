import { useCallback } from 'react'
import PropTypes from 'prop-types'
import { useShareProjectContext } from './share-project-modal'
import Icon from '../../../shared/components/icon'
import { Button, Col, Row } from 'react-bootstrap'
import Tooltip from '../../../shared/components/tooltip'
import { Trans, useTranslation } from 'react-i18next'
import MemberPrivileges from './member-privileges'
import { resendInvite, revokeInvite } from '../utils/api'
import { useProjectContext } from '../../../shared/context/project-context'

export default function Invite({ invite, isProjectOwner }) {
  return (
    <Row className="project-invite">
      <Col xs={7}>
        <div>{invite.email}</div>

        <div className="small">
          <Trans i18nKey="invite_not_accepted" />
          .&nbsp;
          {isProjectOwner && <ResendInvite invite={invite} />}
        </div>
      </Col>

      <Col xs={3} className="text-left">
        <MemberPrivileges privileges={invite.privileges} />
      </Col>

      {isProjectOwner && (
        <Col xs={2} className="text-center">
          <RevokeInvite invite={invite} />
        </Col>
      )}
    </Row>
  )
}

Invite.propTypes = {
  invite: PropTypes.object.isRequired,
  isProjectOwner: PropTypes.bool.isRequired,
}

function ResendInvite({ invite }) {
  const { monitorRequest } = useShareProjectContext()
  const { _id: projectId } = useProjectContext()

  // const buttonRef = useRef(null)
  //
  const handleClick = useCallback(
    () =>
      monitorRequest(() => resendInvite(projectId, invite)).finally(() => {
        // NOTE: disabled as react-bootstrap v0.33.1 isn't forwarding the ref to the `button`
        // if (buttonRef.current) {
        //   buttonRef.current.blur()
        // }
        document.activeElement.blur()
      }),
    [invite, monitorRequest, projectId]
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
  const { t } = useTranslation()
  const { updateProject, monitorRequest } = useShareProjectContext()
  const { _id: projectId, invites } = useProjectContext()

  function handleClick(event) {
    event.preventDefault()

    monitorRequest(() => revokeInvite(projectId, invite)).then(() => {
      updateProject({
        invites: invites.filter(existing => existing !== invite),
      })
    })
  }

  return (
    <Tooltip
      id="revoke-invite"
      description={<Trans i18nKey="revoke_invite" />}
      overlayProps={{ placement: 'bottom' }}
    >
      <Button
        type="button"
        bsStyle="link"
        onClick={handleClick}
        aria-label={t('revoke')}
        className="btn-inline-link"
      >
        <Icon type="times" />
      </Button>
    </Tooltip>
  )
}

RevokeInvite.propTypes = {
  invite: PropTypes.object.isRequired,
}
