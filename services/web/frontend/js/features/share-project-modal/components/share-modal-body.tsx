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

export default function ShareModalBody() {
  const { project, features } = useProjectContext()
  const { members, invites } = project || {}
  const { isProjectOwner } = useEditorContext()

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

      {!getMeta('ol-ExposedSettings').recaptchaDisabled?.invite && (
        <RecaptchaConditions />
      )}
    </>
  )
}
