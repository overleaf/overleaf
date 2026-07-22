import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ShareProjectModalRow from '@/features/share-project-modal/components/share-project-modal-row'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import DropdownMenuItem from '@/shared/components/dropdown/dropdown-menu-item'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import {
  OLDropdown,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import { useProjectContext } from '@/shared/context/project-context'
import { useShareProjectContext } from './share-project-modal'
import {
  declineAccessRequest,
  grantAccessRequest,
} from '@/features/share-project-modal/utils/api'
import type {
  EditAccessRequest,
  ProjectMember,
  RequestedPrivilegeLevel,
} from '@/shared/context/types/project-metadata'
import type { ShareModalScreen } from './share-project-modal-content'

export default function AccessRequests({
  setScreen,
  canAddCollaborators,
}: {
  setScreen: React.Dispatch<React.SetStateAction<ShareModalScreen>>
  canAddCollaborators: boolean
}) {
  const { t } = useTranslation()
  const { projectId, project, updateProject, features } = useProjectContext()
  const { monitorRequest, setSuccessActionMessage } = useShareProjectContext()
  const editAccessRequests = useMemo(
    () => project?.editAccessRequests ?? [],
    [project]
  )

  if (editAccessRequests.length === 0) {
    return (
      <>
        <h3 className="h4 fw-normal mt-3 mb-2 pt-1">{t('access_requests')}</h3>
        <p className="text-muted">{t('no_pending_access_requests')}</p>
      </>
    )
  }

  return (
    <>
      <h3 className="h4 fw-normal mt-3 mb-2 pt-1">{t('access_requests')}</h3>
      {editAccessRequests.map(request => (
        <AccessRequestRow
          key={request._id}
          request={request}
          onActed={actedUserId => {
            const remaining = editAccessRequests.filter(
              r => r._id !== actedUserId
            )
            updateProject({ editAccessRequests: remaining })
            if (remaining.length === 0) {
              setScreen('project-access')
            }
          }}
          projectId={projectId}
          monitorRequest={monitorRequest}
          setSuccessActionMessage={setSuccessActionMessage}
          updateProject={updateProject}
          currentMembers={project?.members ?? []}
          canAddCollaborators={canAddCollaborators}
          collaboratorLimit={features?.collaborators ?? 1}
        />
      ))}
    </>
  )
}

function AccessRequestRow({
  request,
  onActed,
  projectId,
  monitorRequest,
  setSuccessActionMessage,
  updateProject,
  currentMembers,
  canAddCollaborators,
  collaboratorLimit,
}: {
  request: EditAccessRequest
  onActed: (userId: string) => void
  projectId: string
  monitorRequest: ReturnType<typeof useShareProjectContext>['monitorRequest']
  setSuccessActionMessage: (msg: string) => void
  updateProject: ReturnType<typeof useProjectContext>['updateProject']
  currentMembers: ProjectMember[]
  canAddCollaborators: boolean
  collaboratorLimit: number
}) {
  const { t } = useTranslation()
  // Built with static t() calls so the keys are extracted (never t(dynamicKey)).
  const privilegeLabels: Record<RequestedPrivilegeLevel, string> = {
    readAndWrite: t('editor'),
    review: t('reviewer'),
  }
  const [privilege, setPrivilege] = useState<RequestedPrivilegeLevel>(
    request.privilegeLevel
  )
  const [inflight, setInflight] = useState(false)

  // Granting only consumes a new edit-collaborator slot if the requester
  // isn't already an editor/reviewer (e.g. a reviewer asking for editor
  // stays within the same slot). When a new slot is needed and the project
  // is at its limit, block the grant — mirrors the backend guard.
  const needsNewSlot =
    request.currentPrivilegeLevel !== 'readAndWrite' &&
    request.currentPrivilegeLevel !== 'review'
  const limitReached = needsNewSlot && !canAddCollaborators

  const handleDecline = useCallback(() => {
    setInflight(true)
    // The notify toggle was removed for now; always notify the requester of
    // the outcome.
    monitorRequest(() => declineAccessRequest(projectId, request._id, true))
      .then(() => {
        setSuccessActionMessage(t('access_request_declined'))
        onActed(request._id)
      })
      .catch(() => setInflight(false))
  }, [
    monitorRequest,
    onActed,
    projectId,
    request._id,
    setSuccessActionMessage,
    t,
  ])

  const handleShare = useCallback(() => {
    setInflight(true)
    monitorRequest(() =>
      grantAccessRequest(projectId, request._id, privilege, true)
    )
      .then(() => {
        if (!currentMembers.some(m => m._id === request._id)) {
          const stub: ProjectMember = {
            _id: request._id,
            email: request.email,
            first_name: request.first_name,
            last_name: request.last_name,
            privileges: privilege,
          }
          updateProject({ members: [...currentMembers, stub] })
        }
        setSuccessActionMessage(t('access_granted'))
        onActed(request._id)
      })
      .catch(() => setInflight(false))
  }, [
    currentMembers,
    monitorRequest,
    onActed,
    privilege,
    projectId,
    request._id,
    request.email,
    request.first_name,
    request.last_name,
    setSuccessActionMessage,
    t,
    updateProject,
  ])

  return (
    <ShareProjectModalRow>
      <div className="d-flex flex-column gap-2 w-100">
        <div className="d-flex justify-content-between align-items-center gap-2">
          <div className="d-inline-flex align-items-center h5 m-0 gap-2">
            <MaterialIcon type="person" unfilled />
            <div className="px-2">{request.email}</div>
          </div>
          <OLDropdown
            align="end"
            onSelect={(eventKey: RequestedPrivilegeLevel) =>
              eventKey && setPrivilege(eventKey)
            }
          >
            <OLDropdownToggle
              variant="ghost"
              disabled={inflight}
              className="d-flex align-items-center gap-2 no-default-caret"
            >
              {privilegeLabels[privilege]}
              <MaterialIcon type="keyboard_arrow_down" />
            </OLDropdownToggle>
            <OLDropdownMenu>
              <DropdownMenuItem
                as="button"
                eventKey="readAndWrite"
                leadingIcon={<MaterialIcon type="edit" unfilled />}
                active={privilege === 'readAndWrite'}
                trailingIcon={
                  privilege === 'readAndWrite' ? 'check' : undefined
                }
              >
                {t('editor')}
              </DropdownMenuItem>
              <DropdownMenuItem
                as="button"
                eventKey="review"
                leadingIcon={<MaterialIcon type="mode_comment" unfilled />}
                active={privilege === 'review'}
                trailingIcon={privilege === 'review' ? 'check' : undefined}
              >
                {t('reviewer')}
              </DropdownMenuItem>
            </OLDropdownMenu>
          </OLDropdown>
        </div>
        <div className="d-flex justify-content-end align-items-center gap-2 px-2">
          <div className="d-flex align-items-center gap-2">
            {inflight && <OLSpinner size="sm" />}
            <OLButton
              variant="secondary"
              size="sm"
              onClick={handleDecline}
              disabled={inflight}
            >
              {t('decline')}
            </OLButton>
            {limitReached ? (
              <OLTooltip
                id={`access-request-limit-${request._id}`}
                description={t('limited_to_n_collaborators_per_project', {
                  count: collaboratorLimit,
                })}
                overlayProps={{ placement: 'top' }}
              >
                {/* wrapping element so the tooltip still fires while the
                      button is disabled */}
                <div>
                  <OLButton variant="primary" size="sm" disabled>
                    {t('share')}
                  </OLButton>
                </div>
              </OLTooltip>
            ) : (
              <OLButton
                variant="primary"
                size="sm"
                onClick={handleShare}
                disabled={inflight}
              >
                {t('share')}
              </OLButton>
            )}
          </div>
        </div>
      </div>
    </ShareProjectModalRow>
  )
}
