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
  const { members, invites, features } = useProjectContext()
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

    const editorInvites = invites.filter(
      invite => invite.privileges === 'readAndWrite'
    ).length

    return (
      members.filter(member => member.privileges === 'readAndWrite').length +
        editorInvites <
      (features.collaborators ?? 1)
    )
  }, [members, invites, features, isProjectOwner])

  // determine if some but not all pending editors' permissions have been resolved,
  // for moving between warning and info notification states etc.
  const somePendingEditorsResolved = useMemo(() => {
    return (
      members.some(member => member.privileges === 'readAndWrite') &&
      members.some(member => member.pendingEditor)
    )
  }, [members])

  const haveAnyEditorsBeenDowngraded = useMemo(() => {
    if (!isProjectOwner || !features) {
      return false
    }

    if (features.collaborators === -1) {
      return false
    }
    return members.some(member => member.pendingEditor)
  }, [features, isProjectOwner, members])

  const hasExceededCollaboratorLimit = useMemo(() => {
    if (!isProjectOwner || !features) {
      return false
    }

    if (features.collaborators === -1) {
      return false
    }

    return (
      members.filter(member => member.privileges === 'readAndWrite').length >
      (features.collaborators ?? 1)
    )
  }, [features, isProjectOwner, members])

  const sortedMembers = useMemo(() => {
    return [
      ...members.filter(member => member.privileges === 'readAndWrite'),
      ...members.filter(member => member.pendingEditor),
      ...members.filter(
        member => !member.pendingEditor && member.privileges !== 'readAndWrite'
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
            hasBeenDowngraded={member.pendingEditor ?? false}
            canAddCollaborators={canAddCollaborators}
          />
        ) : (
          <ViewMember key={member._id} member={member} />
        )
      )}

      {invites.map(invite => (
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
