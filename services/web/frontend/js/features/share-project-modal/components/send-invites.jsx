import AddCollaborators from './add-collaborators'
import AddCollaboratorsUpgrade from './add-collaborators-upgrade'
import PropTypes from 'prop-types'
import OLRow from '@/features/ui/components/ol/ol-row'

export default function SendInvites({ canAddCollaborators }) {
  return (
    <OLRow className="invite-controls">
      {canAddCollaborators ? <AddCollaborators /> : <AddCollaboratorsUpgrade />}
    </OLRow>
  )
}

SendInvites.propTypes = {
  canAddCollaborators: PropTypes.bool,
}
