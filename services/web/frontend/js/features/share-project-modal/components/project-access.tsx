import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ShareProjectModalRow from '@/features/share-project-modal/components/share-project-modal-row'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import OLDropdownMenuItem from '@/shared/components/ol/ol-dropdown-menu-item'
import {
  Dropdown,
  DropdownDivider,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'
import LinkSharing from '@/features/share-project-modal/components/link-sharing'
import { useEditorContext } from '@/shared/context/editor-context'
import { useProjectContext } from '@/shared/context/project-context'
import {
  SharingLinkData,
  SharingLinkPrivileges,
  setPublicAccessLevel,
  updateSharingLink,
} from '../utils/api'
import MemberPrivileges from '@/features/share-project-modal/components/member-privileges'
import RemoveSharingLinksModal from '@/features/share-project-modal/components/remove-sharing-links-modal'
import {
  ProjectAccessType,
  useShareProjectContext,
} from '@/features/share-project-modal/components/share-project-modal'
import { ExcludeStrict } from '@ol-types/utils'
import getMeta from '@/utils/meta'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { sendMB } from '@/infrastructure/event-tracking'
import { debugConsole } from '@/utils/debugging'

type ProjectAccessProps = {
  setIsInvitedPeopleScreen: React.Dispatch<React.SetStateAction<boolean>>
  invitedPeopleCount: number
}

export type PendingAccessType = ExcludeStrict<
  ProjectAccessType,
  'legacyLinkSharing'
>

function ProjectAccess({
  setIsInvitedPeopleScreen,
  invitedPeopleCount,
}: ProjectAccessProps) {
  const { t } = useTranslation()
  const [pendingAccess, setPendingAccess] = useState<PendingAccessType | null>(
    null
  )
  const { isProjectOwner } = useEditorContext()
  const { activeProfessionalGroupSubscriptions } = getMeta('ol-user')
  const groupSharingEnabled = useFeatureFlag('group-link-sharing')

  const {
    monitorRequest,
    setSuccessActionMessage,
    projectAccess,
    setProjectAccess,
    sharingLinkData,
    setSharingLinkData,
  } = useShareProjectContext()
  const { projectId } = useProjectContext()

  const privileges = sharingLinkData?.privileges

  const handleAccessChange = (newAccess: PendingAccessType) => {
    setPendingAccess(null)

    let reqBody: Pick<SharingLinkData, 'privileges' | 'subscriptionId'>
    if (newAccess === 'onlyInvitedPeople') {
      reqBody = { privileges: false }
    } else if (newAccess.startsWith('anyoneInXyzWithTheLink')) {
      const newSubscriptionId = newAccess.split('.')[1]
      reqBody = {
        privileges: privileges || 'readOnly',
        subscriptionId: newSubscriptionId,
      }
    } else if (newAccess === 'anyoneWithTheLink') {
      reqBody = { privileges: privileges || 'readOnly' }
    } else {
      return
    }

    monitorRequest(async () => {
      const data = await updateSharingLink(projectId, reqBody)

      if (projectAccess === 'legacyLinkSharing') {
        await setPublicAccessLevel(projectId, 'private')
      }

      return data
    })
      .then(data => {
        setSharingLinkData(data)
        setProjectAccess(newAccess)
        setSuccessActionMessage(t('access_updated'))
        sendMB('sharing-link-set-permissions', {
          project_id: projectId,
          access_level: newAccess.split('.')[0],
          ...reqBody,
        })
      })
      .catch(debugConsole.error)
  }

  const onAccessSelect = (eventKey: ProjectAccessType) => {
    if (
      projectAccess === 'legacyLinkSharing' &&
      eventKey !== 'legacyLinkSharing'
    ) {
      // Legacy link sharing: show confirmation first
      setPendingAccess(eventKey as PendingAccessType)
    } else {
      // Non-legacy: fire request directly
      handleAccessChange(eventKey as PendingAccessType)
    }
  }

  const onPrivilegesChange = (
    eventKey: ExcludeStrict<SharingLinkPrivileges, false>
  ) => {
    monitorRequest(() =>
      updateSharingLink(projectId, {
        privileges: eventKey,
        subscriptionId: sharingLinkData?.subscriptionId,
      })
    )
      .then(data => {
        setSharingLinkData(data)
        setSuccessActionMessage(t('access_updated'))
        sendMB('sharing-link-set-permissions', {
          project_id: projectId,
          access_level: projectAccess?.split('.')[0],
          privileges: eventKey,
          subscriptionId: data.subscriptionId,
        })
      })
      .catch(debugConsole.error)
  }

  const getGroupLinkText = (id?: string) => {
    if (
      !id ||
      !activeProfessionalGroupSubscriptions ||
      activeProfessionalGroupSubscriptions.length === 0
    ) {
      return ''
    }
    const subscription = activeProfessionalGroupSubscriptions.find(
      sub => sub._id === id
    )
    if (subscription?.teamName) {
      return t('anyone_in_x_with_the_link', {
        groupName: subscription.teamName,
      })
    } else {
      return t('anyone_in_your_group_with_the_link')
    }
  }

  const getProjectAccessDropdownToggleText = () => {
    if (!projectAccess) return ''
    const [accessType, subscriptionId] = projectAccess.split('.')
    switch (accessType) {
      case 'legacyLinkSharing':
        return t('via_sharing_links_legacy')
      case 'onlyInvitedPeople':
        return t('only_invited_people')
      case 'anyoneInXyzWithTheLink':
        return getGroupLinkText(subscriptionId)
      case 'anyoneWithTheLink':
        return t('anyone_with_the_link')
      default:
        return ''
    }
  }

  return (
    <>
      <h3 className="h4 fw-normal mt-3 mb-2 pt-1">{t('project_access')}</h3>
      <ShareProjectModalRow>
        <div className="d-inline-flex align-items-center h5 m-0 gap-2">
          <MaterialIcon type="group" unfilled />
          <div className="px-2 fw-normal">
            {invitedPeopleCount > 1
              ? t('x_people_invited', { count: invitedPeopleCount })
              : t('no_one_invited_yet')}
          </div>
        </div>
        <OLButton
          variant="ghost"
          trailingIcon="chevron_right"
          onClick={() => setIsInvitedPeopleScreen(true)}
        >
          {t('manage_access')}
        </OLButton>
      </ShareProjectModalRow>
      {projectAccess && (
        <ShareProjectModalRow>
          <div className="d-inline-flex align-items-center h5 m-0">
            {projectAccess === 'legacyLinkSharing' && (
              <MaterialIcon type="link" />
            )}
            {projectAccess === 'onlyInvitedPeople' && (
              <MaterialIcon type="lock" unfilled />
            )}
            {projectAccess.startsWith('anyoneInXyzWithTheLink') && (
              <MaterialIcon type="domain" unfilled />
            )}
            {projectAccess === 'anyoneWithTheLink' && (
              <MaterialIcon type="globe" unfilled />
            )}
            <Dropdown onSelect={onAccessSelect}>
              <DropdownToggle
                variant="ghost"
                className="d-flex align-items-center gap-2 no-default-caret"
              >
                {getProjectAccessDropdownToggleText()}
                <MaterialIcon type="keyboard_arrow_down" />
              </DropdownToggle>
              <DropdownMenu>
                {projectAccess === 'legacyLinkSharing' && (
                  <>
                    <DropdownListItem className="d-flex align-items-center">
                      <DropdownItem
                        as="button"
                        eventKey="legacyLinkSharing"
                        leadingIcon={<MaterialIcon type="link" />}
                        trailingIcon={
                          projectAccess === 'legacyLinkSharing'
                            ? 'check'
                            : undefined
                        }
                        active={projectAccess === 'legacyLinkSharing'}
                      >
                        {t('via_sharing_links_legacy')}
                      </DropdownItem>
                    </DropdownListItem>
                    <DropdownDivider />
                  </>
                )}
                <DropdownListItem className="d-flex align-items-center">
                  <DropdownItem
                    as="button"
                    eventKey="onlyInvitedPeople"
                    leadingIcon={<MaterialIcon type="lock" unfilled />}
                    trailingIcon={
                      projectAccess === 'onlyInvitedPeople'
                        ? 'check'
                        : undefined
                    }
                    active={projectAccess === 'onlyInvitedPeople'}
                  >
                    {t('only_invited_people')}
                  </DropdownItem>
                </DropdownListItem>
                {groupSharingEnabled &&
                  activeProfessionalGroupSubscriptions &&
                  activeProfessionalGroupSubscriptions.map(subscription => (
                    <DropdownListItem
                      className="d-flex align-items-center"
                      key={subscription._id}
                    >
                      <DropdownItem
                        as="button"
                        eventKey={`anyoneInXyzWithTheLink.${subscription._id}`}
                        leadingIcon={<MaterialIcon type="domain" unfilled />}
                        trailingIcon={
                          projectAccess ===
                          `anyoneInXyzWithTheLink.${subscription._id}`
                            ? 'check'
                            : undefined
                        }
                        active={
                          projectAccess ===
                          `anyoneInXyzWithTheLink.${subscription._id}`
                        }
                      >
                        {t('anyone_in_x_with_the_link', {
                          groupName: subscription.teamName || 'your group',
                        })}
                      </DropdownItem>
                    </DropdownListItem>
                  ))}
                <DropdownListItem className="d-flex align-items-center gap-2">
                  <DropdownItem
                    as="button"
                    eventKey="anyoneWithTheLink"
                    leadingIcon={<MaterialIcon type="globe" unfilled />}
                    trailingIcon={
                      projectAccess === 'anyoneWithTheLink'
                        ? 'check'
                        : undefined
                    }
                    active={projectAccess === 'anyoneWithTheLink'}
                  >
                    {t('anyone_with_the_link')}
                  </DropdownItem>
                </DropdownListItem>
              </DropdownMenu>
            </Dropdown>
            {pendingAccess && (
              <RemoveSharingLinksModal
                pendingAccess={pendingAccess}
                onCancel={() => setPendingAccess(null)}
                onConfirm={() => handleAccessChange(pendingAccess)}
              />
            )}
          </div>
          {projectAccess !== 'legacyLinkSharing' && privileges && (
            <Dropdown align="end" onSelect={onPrivilegesChange}>
              <DropdownToggle
                variant="ghost"
                className="d-flex align-items-center gap-2 no-default-caret"
              >
                <MemberPrivileges privileges={privileges} />
                <MaterialIcon type="keyboard_arrow_down" />
              </DropdownToggle>
              <DropdownMenu>
                <OLDropdownMenuItem
                  as="button"
                  eventKey="readAndWrite"
                  leadingIcon={<MaterialIcon type="edit" unfilled />}
                  active={privileges === 'readAndWrite'}
                  trailingIcon={
                    privileges === 'readAndWrite' ? 'check' : undefined
                  }
                >
                  {t('editor')}
                </OLDropdownMenuItem>
                <OLDropdownMenuItem
                  as="button"
                  eventKey="review"
                  leadingIcon={<MaterialIcon type="mode_comment" unfilled />}
                  active={privileges === 'review'}
                  trailingIcon={privileges === 'review' ? 'check' : undefined}
                >
                  {t('reviewer')}
                </OLDropdownMenuItem>
                <OLDropdownMenuItem
                  as="button"
                  eventKey="readOnly"
                  leadingIcon={<MaterialIcon type="visibility" unfilled />}
                  active={privileges === 'readOnly'}
                  trailingIcon={privileges === 'readOnly' ? 'check' : undefined}
                >
                  {t('viewer')}
                </OLDropdownMenuItem>
              </DropdownMenu>
            </Dropdown>
          )}
        </ShareProjectModalRow>
      )}

      {isProjectOwner && <LinkSharing />}
    </>
  )
}

export default ProjectAccess
