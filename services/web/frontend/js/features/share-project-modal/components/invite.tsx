import { useCallback } from 'react'
import { useShareProjectContext } from './share-project-modal'
import { useTranslation } from 'react-i18next'
import MemberPrivileges from './member-privileges'
import { resendInvite, revokeInvite } from '../utils/api'
import { useProjectContext } from '@/shared/context/project-context'
import { sendMB } from '@/infrastructure/event-tracking'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { ProjectMember } from '@/shared/context/types/project-metadata'

export default function Invite({
  invite,
  isProjectOwner,
}: {
  invite: ProjectMember
  isProjectOwner: boolean
}) {
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

function ResendInvite({ invite }: { invite: ProjectMember }) {
  const { t } = useTranslation()
  const { monitorRequest, setError, inFlight } = useShareProjectContext()
  const { projectId } = useProjectContext()

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
          if (document.activeElement) {
            ;(document.activeElement as HTMLElement).blur()
          }
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

function RevokeInvite({ invite }: { invite: ProjectMember }) {
  const { t } = useTranslation()
  const { monitorRequest } = useShareProjectContext()
  const { projectId, project, updateProject } = useProjectContext()
  const { invites, members } = project || {}

  function handleClick(event: React.MouseEvent) {
    event.preventDefault()

    monitorRequest(() => revokeInvite(projectId, invite)).then(() => {
      const updatedInvites =
        invites?.filter(existing => existing !== invite) || []
      updateProject({
        invites: updatedInvites,
      })
      sendMB('collaborator-invite-revoked', {
        project_id: projectId,
        current_invites_amount: updatedInvites.length,
        current_collaborators_amount: members?.length || 0,
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
        className="btn-inline-link text-decoration-none"
      >
        <MaterialIcon type="clear" />
      </OLButton>
    </OLTooltip>
  )
}
