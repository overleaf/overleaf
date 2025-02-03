import AddCollaborators from './add-collaborators'
import AddCollaboratorsUpgrade from './add-collaborators-upgrade'
import CollaboratorsLimitUpgrade from './collaborators-limit-upgrade'
import AccessLevelsChanged from './access-levels-changed'
import PropTypes from 'prop-types'
import OLRow from '@/features/ui/components/ol/ol-row'

export default function SendInvites({
  canAddCollaborators,
  hasExceededCollaboratorLimit,
  haveAnyEditorsBeenDowngraded,
  somePendingEditorsResolved,
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

SendInvites.propTypes = {
  canAddCollaborators: PropTypes.bool,
  hasExceededCollaboratorLimit: PropTypes.bool,
  haveAnyEditorsBeenDowngraded: PropTypes.bool,
  somePendingEditorsResolved: PropTypes.bool,
}
