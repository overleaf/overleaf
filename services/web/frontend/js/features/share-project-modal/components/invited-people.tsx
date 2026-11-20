import { useTranslation } from 'react-i18next'
import OwnerInfo from '@/features/share-project-modal/components/owner-info'
import EditMember from '@/features/share-project-modal/components/edit-member'
import ViewMember from '@/features/share-project-modal/components/view-member'
import Invite from '@/features/share-project-modal/components/invite'
import EnterpriseAccessSection from '@/features/share-project-modal/components/enterprise-access-section'
import { useEditorContext } from '@/shared/context/editor-context'
import { ProjectMember } from '@/shared/context/types/project-metadata'

type InvitedPeopleProps = {
  hasExceededCollaboratorLimit: boolean
  hasTrackChangesFeature: boolean
  canAddCollaborators: boolean
  sortedMembers: ProjectMember[]
  invites?: ProjectMember[]
}

function InvitedPeople({
  hasExceededCollaboratorLimit,
  hasTrackChangesFeature,
  canAddCollaborators,
  sortedMembers,
  invites,
}: InvitedPeopleProps) {
  const { t } = useTranslation()
  const { isProjectOwner, canAdminProject } = useEditorContext()
  const canManageSharing = isProjectOwner || Boolean(canAdminProject)

  return (
    <>
      {!canManageSharing && <EnterpriseAccessSection />}
      <h3 className="h4 fw-normal mt-3 mb-2 pt-1">{t('invited_people')}</h3>
      <OwnerInfo />
      {sortedMembers.map(member =>
        canManageSharing ? (
          <EditMember
            key={member._id}
            member={member}
            hasExceededCollaboratorLimit={hasExceededCollaboratorLimit}
            hasBeenDowngraded={Boolean(
              member.pendingEditor || member.pendingReviewer
            )}
            canAddCollaborators={canAddCollaborators}
            isReviewerOnFreeProject={
              member.privileges === 'review' && !hasTrackChangesFeature
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
          isProjectOwner={canManageSharing}
        />
      ))}
    </>
  )
}

export default InvitedPeople
