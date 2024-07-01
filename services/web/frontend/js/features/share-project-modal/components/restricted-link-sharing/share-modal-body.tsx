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

  return (
    <>
      {isProjectOwner ? (
        <SendInvites
          canAddCollaborators={canAddCollaborators}
          hasExceededCollaboratorLimit={hasExceededCollaboratorLimit}
        />
      ) : (
        <SendInvitesNotice />
      )}
      {isProjectOwner && <LinkSharing />}

      <OwnerInfo />

      {members.map(member =>
        isProjectOwner ? (
          <EditMember
            key={member._id}
            member={member}
            hasExceededCollaboratorLimit={hasExceededCollaboratorLimit}
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
