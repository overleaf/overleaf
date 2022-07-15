import EditMember from './edit-member'
import LinkSharing from './link-sharing'
import Invite from './invite'
import SendInvites from './send-invites'
import ViewMember from './view-member'
import OwnerInfo from './owner-info'
import SendInvitesNotice from './send-invites-notice'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useProjectContext } from '../../../shared/context/project-context'
import { useSplitTestContext } from '../../../shared/context/split-test-context'
import { useMemo } from 'react'
import { Row } from 'react-bootstrap'
import PropTypes from 'prop-types'
import RecaptchaConditions from '../../../shared/components/recaptcha-conditions'

export default function ShareModalBody() {
  const { splitTestVariants } = useSplitTestContext({
    splitTestVariants: PropTypes.object,
  })

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

    return members.length + invites.length < features.collaborators
  }, [members, invites, features, isProjectOwner])

  switch (splitTestVariants['project-share-modal-paywall']) {
    case 'new-copy-top':
      return (
        <>
          {isProjectOwner ? (
            <>
              <SendInvites canAddCollaborators={canAddCollaborators} />
              <Row className="public-access-level" />
            </>
          ) : (
            <SendInvitesNotice />
          )}

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

          {isProjectOwner && (
            <>
              <br />
              <LinkSharing canAddCollaborators={canAddCollaborators} />
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

          {isProjectOwner && (
            <>
              <br />
              <LinkSharing canAddCollaborators={canAddCollaborators} />
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
          {isProjectOwner && (
            <LinkSharing canAddCollaborators={canAddCollaborators} />
          )}

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

          {!window.ExposedSettings.recaptchaDisabled?.invite && (
            <RecaptchaConditions />
          )}
        </>
      )
  }
}
