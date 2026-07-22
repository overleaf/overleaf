import EditMember from './edit-member'
import LinkSharing from './link-sharing'
import Invite from './invite'
import SendInvites from './send-invites'
import ViewMember from './view-member'
import OwnerInfo from './owner-info'
import SendInvitesNotice from './send-invites-notice'
import { useEditorContext } from '@/shared/context/editor-context'
import { useProjectContext } from '@/shared/context/project-context'
import { useMemo } from 'react'
import RecaptchaConditions from '@/shared/components/recaptcha-conditions'
import getMeta from '@/utils/meta'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import Notification from '@/shared/components/notification'
import ErrorMessage from '@/features/share-project-modal/components/error-message'
import ProjectAccess from '@/features/share-project-modal/components/project-access'
import InvitedPeople from '@/features/share-project-modal/components/invited-people'
import AccessRequests from '@/features/share-project-modal/components/access-requests'
import type { ProjectMember } from '@/shared/context/types/project-metadata'
import type { ShareModalScreen } from './share-project-modal-content'

type ShareModalBodyProps = {
  screen: ShareModalScreen
  setScreen: React.Dispatch<React.SetStateAction<ShareModalScreen>>
  error?: string
}

export default function ShareModalBody({
  screen,
  setScreen,
  error,
}: ShareModalBodyProps) {
  const { project, features } = useProjectContext()
  const { members, invites } = project || {}
  const { isProjectOwner } = useEditorContext()
  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')

  // whether the project has not reached the collaborator limit
  const canAddCollaborators = useMemo(() => {
    if (!isProjectOwner || !features) {
      return false
    }

    if (features.collaborators === -1) {
      // infinite collaborators
      return true
    }

    const editorInvites =
      invites?.filter(invite => invite.privileges !== 'readOnly').length || 0

    return (
      (members?.filter(member => member.privileges !== 'readOnly').length ||
        0) +
        editorInvites <
      (features.collaborators ?? 1)
    )
  }, [members, invites, features, isProjectOwner])

  // determine if some but not all pending editors' permissions have been resolved,
  // for moving between warning and info notification states etc.
  const somePendingEditorsResolved = useMemo(() => {
    return Boolean(
      members?.some(member =>
        ['readAndWrite', 'review'].includes(member.privileges)
      ) &&
      members?.some(member => member.pendingEditor || member.pendingReviewer)
    )
  }, [members])

  const haveAnyEditorsBeenDowngraded = useMemo(() => {
    if (!isProjectOwner || !features) {
      return false
    }

    if (features.collaborators === -1) {
      return false
    }
    return (
      members?.some(member => member.pendingEditor || member.pendingReviewer) ||
      false
    )
  }, [features, isProjectOwner, members])

  const hasExceededCollaboratorLimit = useMemo(() => {
    if (!isProjectOwner || !features || !members) {
      return false
    }

    if (features.collaborators === -1) {
      return false
    }

    return (
      members.filter(member => member.privileges !== 'readOnly').length >
      (features.collaborators ?? 1)
    )
  }, [features, isProjectOwner, members])

  const sortedMembers = useMemo(() => {
    if (!members) {
      return []
    }
    return [
      ...members.filter(member => member.privileges === 'readAndWrite'),
      ...members.filter(member => member.pendingEditor),
      ...members.filter(member => member.privileges === 'review'),
      ...members.filter(member => member.pendingReviewer),
      ...members.filter(
        member =>
          !member.pendingEditor &&
          !member.pendingReviewer &&
          !['readAndWrite', 'review'].includes(member.privileges)
      ),
    ]
  }, [members])

  return (
    <>
      {isProjectOwner ? (
        <SendInvites
          canAddCollaborators={canAddCollaborators}
          hasExceededCollaboratorLimit={hasExceededCollaboratorLimit}
          haveAnyEditorsBeenDowngraded={haveAnyEditorsBeenDowngraded}
          somePendingEditorsResolved={somePendingEditorsResolved}
        />
      ) : (
        <SendInvitesNotice />
      )}
      {isSharingUpdatesEnabled ? (
        <>
          {error && (
            <div className="notification-list">
              <Notification
                type="error"
                content={<ErrorMessage error={error} />}
              />
            </div>
          )}
          <ShareModalScreenContent
            screen={screen}
            setScreen={setScreen}
            isProjectOwner={isProjectOwner}
            sortedMembers={sortedMembers}
            invites={invites}
            canAddCollaborators={canAddCollaborators}
            hasExceededCollaboratorLimit={hasExceededCollaboratorLimit}
            hasTrackChangesFeature={Boolean(features.trackChanges)}
          />
        </>
      ) : (
        <>
          {isProjectOwner && <LinkSharing />}

          <OwnerInfo />

          {sortedMembers.map(member =>
            isProjectOwner ? (
              <EditMember
                key={member._id}
                member={member}
                hasExceededCollaboratorLimit={hasExceededCollaboratorLimit}
                hasBeenDowngraded={Boolean(
                  member.pendingEditor || member.pendingReviewer
                )}
                canAddCollaborators={canAddCollaborators}
                isReviewerOnFreeProject={
                  member.privileges === 'review' && !features.trackChanges
                }
              />
            ) : (
              <ViewMember key={member._id} member={member} />
            )
          )}

          {(invites || []).map(invite => (
            <Invite
              key={invite._id}
              invite={invite}
              isProjectOwner={isProjectOwner}
            />
          ))}
        </>
      )}
      {!getMeta('ol-ExposedSettings').recaptchaDisabled?.invite && (
        <RecaptchaConditions />
      )}
    </>
  )
}

type ShareModalScreenContentProps = {
  screen: ShareModalScreen
  setScreen: React.Dispatch<React.SetStateAction<ShareModalScreen>>
  isProjectOwner: boolean
  sortedMembers: ProjectMember[]
  invites?: ProjectMember[]
  canAddCollaborators: boolean
  hasExceededCollaboratorLimit: boolean
  hasTrackChangesFeature: boolean
}

// Picks the screen to render inside the new share modal. Non-owners only ever
// see the "invited people" view.
function ShareModalScreenContent({
  screen,
  setScreen,
  isProjectOwner,
  sortedMembers,
  invites,
  canAddCollaborators,
  hasExceededCollaboratorLimit,
  hasTrackChangesFeature,
}: ShareModalScreenContentProps) {
  const effectiveScreen = isProjectOwner ? screen : 'invited-people'

  if (effectiveScreen === 'access-requests') {
    return (
      <AccessRequests
        setScreen={setScreen}
        canAddCollaborators={canAddCollaborators}
      />
    )
  }

  if (effectiveScreen === 'invited-people') {
    return (
      <InvitedPeople
        sortedMembers={sortedMembers}
        invites={invites}
        hasExceededCollaboratorLimit={hasExceededCollaboratorLimit}
        hasTrackChangesFeature={hasTrackChangesFeature}
        canAddCollaborators={canAddCollaborators}
      />
    )
  }

  return (
    <ProjectAccess
      setScreen={setScreen}
      invitedPeopleCount={sortedMembers.length + (invites || []).length}
    />
  )
}
