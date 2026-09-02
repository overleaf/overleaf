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
import OLBadge from '@/shared/components/ol/ol-badge'
import DropdownMenuItem from '@/shared/components/dropdown/dropdown-menu-item'
import {
  OLDropdown,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import ShareProjectModalRow from '@/features/share-project-modal/components/share-project-modal-row'
import MaterialIcon from '@/shared/components/material-icon'
import { ProjectMember } from '@/shared/context/types/project-metadata'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export default function Invite({
  invite,
  isProjectOwner,
}: {
  invite: ProjectMember
  isProjectOwner: boolean
}) {
  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')
  const { t } = useTranslation()

  return isSharingUpdatesEnabled ? (
    <ShareProjectModalRow>
      <div className="d-inline-flex align-items-center h5 m-0 gap-2">
        <MaterialIcon type="person" unfilled />
        <div className="px-2">{invite.email}</div>
        <OLBadge bg="light" text="dark">
          {t('pending_invite')}
        </OLBadge>
      </div>
      {isProjectOwner ? (
        <OLDropdown align="end" onSelect={() => {}}>
          <OLDropdownToggle
            variant="ghost"
            className="d-flex align-items-center gap-2 no-default-caret"
          >
            <MemberPrivileges privileges={invite.privileges} />
            <MaterialIcon type="keyboard_arrow_down" />
          </OLDropdownToggle>
          <OLDropdownMenu>
            <ResendInvite invite={invite} />
            <RevokeInvite invite={invite} />
          </OLDropdownMenu>
        </OLDropdown>
      ) : (
        <div className="h5 m-0 px-4 fw-semibold">
          <div className="form-control-plaintext border-0">
            <MemberPrivileges privileges={invite.privileges} />
          </div>
        </div>
      )}
    </ShareProjectModalRow>
  ) : (
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
  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')
  const { t } = useTranslation()
  const { monitorRequest, setError, inFlight, setSuccessActionMessage } =
    useShareProjectContext()
  const { projectId } = useProjectContext()

  // const buttonRef = useRef(null)
  //
  const handleClick = useCallback(
    () =>
      monitorRequest(() => resendInvite(projectId, invite))
        .then(() => setSuccessActionMessage(t('invite_resent')))
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
    [invite, monitorRequest, projectId, setError, setSuccessActionMessage, t]
  )

  return isSharingUpdatesEnabled ? (
    <DropdownMenuItem
      as="button"
      leadingIcon={<MaterialIcon type="mail" unfilled />}
      onClick={handleClick}
      disabled={inFlight}
    >
      {t('resend_invite')}
    </DropdownMenuItem>
  ) : (
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
  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')
  const { t } = useTranslation()
  const { monitorRequest, setSuccessActionMessage } = useShareProjectContext()
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
      setSuccessActionMessage(t('invite_revoked'))
    })
  }

  return isSharingUpdatesEnabled ? (
    <DropdownMenuItem
      as="button"
      leadingIcon={<MaterialIcon type="block" unfilled />}
      variant="danger"
      onClick={handleClick}
    >
      {t('revoke_invite')}
    </DropdownMenuItem>
  ) : (
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
