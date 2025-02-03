import { useCallback } from 'react'
import PropTypes from 'prop-types'
import { useShareProjectContext } from './share-project-modal'
import Icon from '@/shared/components/icon'
import { useTranslation } from 'react-i18next'
import MemberPrivileges from './member-privileges'
import { resendInvite, revokeInvite } from '../utils/api'
import { useProjectContext } from '@/shared/context/project-context'
import { sendMB } from '@/infrastructure/event-tracking'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLButton from '@/features/ui/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { bsVersion } from '@/features/utils/bootstrap-5'
import classnames from 'classnames'

export default function Invite({ invite, isProjectOwner }) {
  const { t } = useTranslation()
  return (
    <OLRow className="project-invite">
      <OLCol xs={8}>
        <div>{invite.email}</div>
        <div className="small">
          {t('invite_not_accepted')}
          .&nbsp;
          {isProjectOwner && <ResendInvite invite={invite} />}
        </div>
      </OLCol>

      <OLCol xs={3} className="text-end">
        <MemberPrivileges privileges={invite.privileges} />
      </OLCol>

      {isProjectOwner && (
        <OLCol xs={1} className="text-center">
          <RevokeInvite invite={invite} />
        </OLCol>
      )}
    </OLRow>
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
    <OLButton
      variant="link"
      className="btn-inline-link"
      onClick={handleClick}
      disabled={inFlight}
      // ref={buttonRef}
    >
      {t('resend')}
    </OLButton>
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
    <OLTooltip
      id="revoke-invite"
      description={t('revoke_invite')}
      overlayProps={{ placement: 'bottom' }}
    >
      <OLButton
        variant="link"
        onClick={handleClick}
        aria-label={t('revoke')}
        className={classnames(
          'btn-inline-link',
          bsVersion({ bs5: 'text-decoration-none' })
        )}
      >
        <BootstrapVersionSwitcher
          bs3={<Icon type="times" />}
          bs5={<MaterialIcon type="clear" />}
        />
      </OLButton>
    </OLTooltip>
  )
}

RevokeInvite.propTypes = {
  invite: PropTypes.object.isRequired,
}
