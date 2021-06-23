import {
  useProjectContext,
  useShareProjectContext,
} from './share-project-modal'
import EditMember from './edit-member'
import LinkSharing from './link-sharing'
import Invite from './invite'
import SendInvites from './send-invites'
import ViewMember from './view-member'
import OwnerInfo from './owner-info'
import SendInvitesNotice from './send-invites-notice'

export default function ShareModalBody() {
  const { isAdmin } = useShareProjectContext()

  const project = useProjectContext()

  return (
    <>
      {isAdmin && <LinkSharing />}

      <OwnerInfo />

      {project.members.map(member =>
        isAdmin ? (
          <EditMember key={member._id} member={member} />
        ) : (
          <ViewMember key={member._id} member={member} />
        )
      )}

      {project.invites.map(invite => (
        <Invite key={invite._id} invite={invite} isAdmin={isAdmin} />
      ))}

      {isAdmin ? <SendInvites /> : <SendInvitesNotice />}
    </>
  )
}
