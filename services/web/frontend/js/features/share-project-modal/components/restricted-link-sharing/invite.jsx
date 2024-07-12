import { useCallback } from 'react'
import PropTypes from 'prop-types'
import { useShareProjectContext } from './share-project-modal'
import Icon from '@/shared/components/icon'
import { Button, Col, Row } from 'react-bootstrap'
import Tooltip from '@/shared/components/tooltip'
import { useTranslation } from 'react-i18next'
import MemberPrivileges from './member-privileges'
import { resendInvite, revokeInvite } from '../../utils/api'
import { useProjectContext } from '@/shared/context/project-context'
import { sendMB } from '@/infrastructure/event-tracking'

export default function Invite({ invite, isProjectOwner }) {
  const { t } = useTranslation()
  return (
    <Row className="project-invite">
      <Col xs={8}>
        <div>{invite.email}</div>
        <div className="small">
          {t('invite_not_accepted')}
          .&nbsp;
          {isProjectOwner && <ResendInvite invite={invite} />}
        </div>
      </Col>

      <Col xs={3} className="text-right">
        <MemberPrivileges privileges={invite.privileges} />
      </Col>

      {isProjectOwner && (
        <Col xs={1} className="text-center">
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
  const { t } = useTranslation()
  const { monitorRequest, setError, inFlight } = useShareProjectContext()
  const { _id: projectId } = useProjectContext()

  // const buttonRef = useRef(null)
  //
  const handleClick = useCallback(
    () =>
      monitorRequest(() => resendInvite(projectId, invite))
        .catch(error => {
          if (error?.response?.status === 404) {
            setError('invite_expired')
          }
          if (error?.response?.status === 429) {
            setError('invite_resend_limit_hit')
          }
        })
        .finally(() => {
          // NOTE: disabled as react-bootstrap v0.33.1 isn't forwarding the ref to the `button`
          // if (buttonRef.current) {
          //   buttonRef.current.blur()
          // }
          document.activeElement.blur()
        }),
    [invite, monitorRequest, projectId, setError]
  )

  return (
    <Button
      bsStyle="link"
      className="btn-inline-link"
      onClick={handleClick}
      disabled={inFlight}
      // ref={buttonRef}
    >
      {t('resend')}
    </Button>
  )
}

ResendInvite.propTypes = {
  invite: PropTypes.object.isRequired,
}

function RevokeInvite({ invite }) {
  const { t } = useTranslation()
  const { updateProject, monitorRequest } = useShareProjectContext()
  const { _id: projectId, invites, members } = useProjectContext()

  function handleClick(event) {
    event.preventDefault()

    monitorRequest(() => revokeInvite(projectId, invite)).then(() => {
      const updatedInvites = invites.filter(existing => existing !== invite)
      updateProject({
        invites: updatedInvites,
      })
      sendMB('collaborator-invite-revoked', {
        project_id: projectId,
        current_invites_amount: updatedInvites.length,
        current_collaborators_amount: members.length,
      })
    })
  }

  return (
    <Tooltip
      id="revoke-invite"
      description={t('revoke_invite')}
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
