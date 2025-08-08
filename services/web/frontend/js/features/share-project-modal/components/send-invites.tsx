import AddCollaborators from './add-collaborators'
import AddCollaboratorsUpgrade from './add-collaborators-upgrade'
import CollaboratorsLimitUpgrade from './collaborators-limit-upgrade'
import AccessLevelsChanged from './access-levels-changed'
import OLRow from '@/shared/components/ol/ol-row'

export default function SendInvites({
  canAddCollaborators,
  hasExceededCollaboratorLimit,
  haveAnyEditorsBeenDowngraded,
  somePendingEditorsResolved,
}: {
  canAddCollaborators: boolean
  hasExceededCollaboratorLimit: boolean
  haveAnyEditorsBeenDowngraded: boolean
  somePendingEditorsResolved: boolean
}) {
  return (
    <OLRow className="invite-controls">
      {hasExceededCollaboratorLimit && !haveAnyEditorsBeenDowngraded && (
        <AddCollaboratorsUpgrade />
      )}

      {haveAnyEditorsBeenDowngraded && (
        <AccessLevelsChanged
          somePendingEditorsResolved={somePendingEditorsResolved}
        />
      )}

      {!canAddCollaborators &&
        !hasExceededCollaboratorLimit &&
        !haveAnyEditorsBeenDowngraded && <CollaboratorsLimitUpgrade />}
      <AddCollaborators readOnly={!canAddCollaborators} />
    </OLRow>
  )
}
