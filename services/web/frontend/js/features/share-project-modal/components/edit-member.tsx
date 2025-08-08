import { useState, useEffect, useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useShareProjectContext } from './share-project-modal'
import TransferOwnershipModal from './transfer-ownership-modal'
import { removeMemberFromProject, updateMember } from '../utils/api'
import { useProjectContext } from '@/shared/context/project-context'
import { sendMB } from '@/infrastructure/event-tracking'
import { Select } from '@/shared/components/select'
import type { ProjectMember } from '@/shared/context/types/project-metadata'
import { PermissionsLevel } from '@/features/ide-react/types/permissions'
import { linkSharingEnforcementDate } from '../utils/link-sharing'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLCol from '@/shared/components/ol/ol-col'
import MaterialIcon from '@/shared/components/material-icon'
import { useUserContext } from '@/shared/context/user-context'
import { upgradePlan } from '@/main/account-upgrade'

type PermissionsOption = PermissionsLevel | 'removeAccess' | 'downgraded'

type EditMemberProps = {
  member: ProjectMember
  hasExceededCollaboratorLimit: boolean
  hasBeenDowngraded: boolean
  canAddCollaborators: boolean
  isReviewerOnFreeProject?: boolean
}

type Privilege = {
  key: PermissionsOption
  label: string
}

export default function EditMember({
  member,
  hasExceededCollaboratorLimit,
  hasBeenDowngraded,
  canAddCollaborators,
  isReviewerOnFreeProject,
}: EditMemberProps) {
  const [privileges, setPrivileges] = useState<PermissionsOption>(
    member.privileges
  )
  const [confirmingOwnershipTransfer, setConfirmingOwnershipTransfer] =
    useState(false)
  const [privilegeChangePending, setPrivilegeChangePending] = useState(false)
  const { t } = useTranslation()

  // update the local state if the member's privileges change externally
  useEffect(() => {
    setPrivileges(member.privileges)
  }, [member.privileges])

  const { monitorRequest } = useShareProjectContext()
  const { projectId, project, updateProject } = useProjectContext()
  const { members, invites } = project || {}
  const user = useUserContext()

  // Immediately commit this change if it's lower impact (eg. editor > viewer)
  // but show a confirmation button for removing access
  function handlePrivilegeChange(newPrivileges: PermissionsOption) {
    sendMB('collaborator-role-change', {
      previousMode: member.privileges,
      newMode: newPrivileges,
      ownerId: user.id,
    })

    setPrivileges(newPrivileges)
    if (newPrivileges !== 'removeAccess') {
      commitPrivilegeChange(newPrivileges)
    } else {
      setPrivilegeChangePending(true)
    }
  }

  function shouldWarnMember() {
    return (
      hasExceededCollaboratorLimit &&
      ['readAndWrite', 'review'].includes(privileges)
    )
  }

  function commitPrivilegeChange(newPrivileges: PermissionsOption) {
    setPrivileges(newPrivileges)
    setPrivilegeChangePending(false)

    if (newPrivileges === 'owner') {
      setConfirmingOwnershipTransfer(true)
    } else if (newPrivileges === 'removeAccess') {
      monitorRequest(() => removeMemberFromProject(projectId, member)).then(
        () => {
          const updatedMembers =
            members?.filter(existing => existing !== member) || []
          updateProject({
            members: updatedMembers,
          })
          sendMB('collaborator-removed', {
            project_id: projectId,
            current_collaborators_amount: updatedMembers.length,
            current_invites_amount: invites?.length || 0,
          })
        }
      )
    } else if (
      newPrivileges === 'readAndWrite' ||
      newPrivileges === 'review' ||
      newPrivileges === 'readOnly'
    ) {
      monitorRequest(() =>
        updateMember(projectId, member, {
          privilegeLevel: newPrivileges,
        })
      ).then(() => {
        updateProject({
          members:
            members?.map(item =>
              item._id === member._id ? { ...item, newPrivileges } : item
            ) || [],
        })
      })
    }
  }

  if (confirmingOwnershipTransfer) {
    return (
      <TransferOwnershipModal
        member={member}
        cancel={() => {
          setConfirmingOwnershipTransfer(false)
          setPrivileges(member.privileges)
        }}
      />
    )
  }

  const confirmRemoval =
    privileges !== member.privileges && privilegeChangePending

  return (
    <form
      id="share-project-form"
      onSubmit={e => {
        e.preventDefault()
        if (privilegeChangePending) {
          commitPrivilegeChange(privileges)
        }
      }}
    >
      <OLFormGroup className="project-member row">
        <OLCol xs={8}>
          <div className="project-member-email-icon">
            <MaterialIcon
              type={
                shouldWarnMember() ||
                member.pendingEditor ||
                member.pendingReviewer
                  ? 'warning'
                  : 'person'
              }
              className={
                shouldWarnMember() ||
                member.pendingEditor ||
                member.pendingReviewer
                  ? 'project-member-warning'
                  : undefined
              }
            />
            <div className="email-warning">
              {member.email}
              {member.pendingEditor && (
                <div className="subtitle">{t('view_only_downgraded')}</div>
              )}
              {member.pendingReviewer && (
                <div className="subtitle">
                  {t('view_only_reviewer_downgraded')}
                </div>
              )}
              {shouldWarnMember() && (
                <div className="subtitle">
                  {t('will_lose_edit_access_on_date', {
                    date: linkSharingEnforcementDate,
                  })}
                </div>
              )}
              {isReviewerOnFreeProject && (
                <div className="small">
                  <Trans
                    i18nKey="comment_only_upgrade_to_enable_track_changes"
                    components={[
                      // eslint-disable-next-line react/jsx-key
                      <OLButton
                        variant="link"
                        className="btn-inline-link"
                        onClick={() => upgradePlan('track-changes')}
                      />,
                    ]}
                  />
                </div>
              )}
            </div>
          </div>
        </OLCol>

        <OLCol xs={4} className="project-member-actions">
          {confirmRemoval && (
            <ChangePrivilegesActions
              handleReset={() => setPrivileges(member.privileges)}
            />
          )}

          <div className="project-member-select">
            {hasBeenDowngraded && !confirmRemoval && (
              <MaterialIcon type="warning" className="project-member-warning" />
            )}

            <SelectPrivilege
              value={privileges}
              handleChange={value => {
                if (value) {
                  handlePrivilegeChange(value.key)
                }
              }}
              hasBeenDowngraded={hasBeenDowngraded && !confirmRemoval}
              canAddCollaborators={canAddCollaborators}
            />
          </div>
        </OLCol>
      </OLFormGroup>
    </form>
  )
}

type SelectPrivilegeProps = {
  value: string
  handleChange: (item: Privilege | null | undefined) => void
  hasBeenDowngraded: boolean
  canAddCollaborators: boolean
}

function SelectPrivilege({
  value,
  handleChange,
  hasBeenDowngraded,
  canAddCollaborators,
}: SelectPrivilegeProps) {
  const { t } = useTranslation()
  const { features } = useProjectContext()

  const privileges = useMemo(
    (): Privilege[] =>
      features.trackChangesVisible
        ? [
            { key: 'owner', label: t('make_owner') },
            { key: 'readAndWrite', label: t('editor') },
            { key: 'review', label: t('reviewer') },
            { key: 'readOnly', label: t('viewer') },
            { key: 'removeAccess', label: t('remove_access') },
          ]
        : [
            { key: 'owner', label: t('make_owner') },
            { key: 'readAndWrite', label: t('editor') },
            { key: 'readOnly', label: t('viewer') },
            { key: 'removeAccess', label: t('remove_access') },
          ],
    [features.trackChangesVisible, t]
  )

  const downgradedPseudoPrivilege: Privilege = {
    key: 'downgraded',
    label: t('select_access_level'),
  }

  function getPrivilegeSubtitle(privilege: PermissionsOption) {
    if (!['readAndWrite', 'review'].includes(privilege)) {
      return ''
    }

    if (
      hasBeenDowngraded ||
      (!canAddCollaborators && !['readAndWrite', 'review'].includes(value))
    ) {
      return t('limited_to_n_collaborators_per_project', {
        count: features.collaborators,
      })
    } else {
      return ''
    }
  }

  function isPrivilegeDisabled(privilege: PermissionsOption) {
    return (
      !canAddCollaborators &&
      ['readAndWrite', 'review'].includes(privilege) &&
      (hasBeenDowngraded || !['readAndWrite', 'review'].includes(value))
    )
  }

  return (
    <Select
      items={privileges}
      itemToKey={item => item.key}
      itemToString={item => (item ? item.label : '')}
      itemToSubtitle={item => (item ? getPrivilegeSubtitle(item.key) : '')}
      itemToDisabled={item => (item ? isPrivilegeDisabled(item.key) : false)}
      defaultItem={privileges.find(item => item.key === value)}
      selected={
        hasBeenDowngraded
          ? downgradedPseudoPrivilege
          : privileges.find(item => item.key === value)
      }
      name="privileges"
      onSelectedItemChanged={handleChange}
      selectedIcon
    />
  )
}

type ChangePrivilegesActionsProps = {
  handleReset: React.ComponentProps<typeof OLButton>['onClick']
}

function ChangePrivilegesActions({
  handleReset,
}: ChangePrivilegesActionsProps) {
  const { t } = useTranslation()

  return (
    <div className="text-center">
      <OLButton type="submit" size="sm" variant="primary">
        {t('change_or_cancel-change')}
      </OLButton>
      <div className="text-sm">
        {t('change_or_cancel-or')}
        &nbsp;
        <OLButton
          variant="link"
          className="btn-inline-link"
          onClick={handleReset}
        >
          {t('change_or_cancel-cancel')}
        </OLButton>
      </div>
    </div>
  )
}
