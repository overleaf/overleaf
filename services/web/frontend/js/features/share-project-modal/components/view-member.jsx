import PropTypes from 'prop-types'
import MemberPrivileges from './member-privileges'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'

export default function ViewMember({ member }) {
  return (
    <OLRow className="project-member">
      <OLCol xs={7}>{member.email}</OLCol>
      <OLCol xs={3}>
        <MemberPrivileges privileges={member.privileges} />
      </OLCol>
    </OLRow>
  )
}

ViewMember.propTypes = {
  member: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    privileges: PropTypes.string.isRequired,
  }).isRequired,
}
