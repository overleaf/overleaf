import EditMember from './edit-member'
import LinkSharing from './link-sharing'
import Invite from './invite'
import SendInvites from './send-invites'
import ViewMember from './view-member'
import OwnerInfo from './owner-info'
import SendInvitesNotice from './send-invites-notice'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useProjectContext } from '../../../shared/context/project-context'
import { useMemo } from 'react'
import RecaptchaConditions from '../../../shared/components/recaptcha-conditions'
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

    return members.length + invites.length < (features.collaborators ?? 1)
  }, [members, invites, features, isProjectOwner])

  return (
    <>
      {isProjectOwner && <LinkSharing />}

      <OwnerInfo />

      {members.map(member =>
        isProjectOwner ? (
          <EditMember key={member._id} member={member} />
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

      {isProjectOwner ? (
        <SendInvites canAddCollaborators={canAddCollaborators} />
      ) : (
        <SendInvitesNotice />
      )}

      {!getMeta('ol-ExposedSettings').recaptchaDisabled?.invite && (
        <RecaptchaConditions />
      )}
    </>
  )
}
