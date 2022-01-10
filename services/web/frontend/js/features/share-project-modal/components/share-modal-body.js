import { useShareProjectContext } from './share-project-modal'
import EditMember from './edit-member'
import LinkSharing from './link-sharing'
import Invite from './invite'
import SendInvites from './send-invites'
import ViewMember from './view-member'
import OwnerInfo from './owner-info'
import SendInvitesNotice from './send-invites-notice'
import { useProjectContext } from '../../../shared/context/project-context'
import { useSplitTestContext } from '../../../shared/context/split-test-context'
import { Row } from 'react-bootstrap'
import PropTypes from 'prop-types'
import RecaptchaConditions from '../../../shared/components/recaptcha-conditions'

export default function ShareModalBody() {
  const { isAdmin } = useShareProjectContext()
  const { splitTestVariants } = useSplitTestContext({
    splitTestVariants: PropTypes.object,
  })

  const { invites, members } = useProjectContext()

  switch (splitTestVariants['project-share-modal-paywall']) {
    case 'new-copy-top':
      return (
        <>
          {isAdmin ? (
            <>
              <SendInvites />
              <Row className="public-access-level" />
            </>
          ) : (
            <SendInvitesNotice />
          )}

          <OwnerInfo />

          {members.map(member =>
            isAdmin ? (
              <EditMember key={member._id} member={member} />
            ) : (
              <ViewMember key={member._id} member={member} />
            )
          )}

          {invites.map(invite => (
            <Invite key={invite._id} invite={invite} isAdmin={isAdmin} />
          ))}

          {isAdmin && (
            <>
              <br />
              <LinkSharing />
            </>
          )}

          {!window.ExposedSettings.recaptchaDisabled?.invite && (
            <RecaptchaConditions />
          )}
        </>
      )
    case 'new-copy-middle':
      return (
        <>
          <OwnerInfo />

          {members.map(member =>
            isAdmin ? (
              <EditMember key={member._id} member={member} />
            ) : (
              <ViewMember key={member._id} member={member} />
            )
          )}

          {invites.map(invite => (
            <Invite key={invite._id} invite={invite} isAdmin={isAdmin} />
          ))}

          {isAdmin ? <SendInvites /> : <SendInvitesNotice />}

          {isAdmin && (
            <>
              <br />
              <LinkSharing />
            </>
          )}

          {!window.ExposedSettings.recaptchaDisabled?.invite && (
            <RecaptchaConditions />
          )}
        </>
      )
    case 'new-copy-bottom':
    case 'default':
    default:
      return (
        <>
          {isAdmin && <LinkSharing />}

          <OwnerInfo />

          {members.map(member =>
            isAdmin ? (
              <EditMember key={member._id} member={member} />
            ) : (
              <ViewMember key={member._id} member={member} />
            )
          )}

          {invites.map(invite => (
            <Invite key={invite._id} invite={invite} isAdmin={isAdmin} />
          ))}

          {isAdmin ? <SendInvites /> : <SendInvitesNotice />}

          {!window.ExposedSettings.recaptchaDisabled?.invite && (
            <RecaptchaConditions />
          )}
        </>
      )
  }
}
