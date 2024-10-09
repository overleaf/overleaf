import PropTypes from 'prop-types'
import MemberPrivileges from './member-privileges'
import Icon from '@/shared/components/icon'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

export default function ViewMember({ member }) {
  return (
    <OLRow className="project-member">
      <OLCol xs={8}>
        <div className="project-member-email-icon">
          <BootstrapVersionSwitcher
            bs3={<Icon type="user" fw />}
            bs5={<MaterialIcon type="person" />}
          />
          <div className="email-warning">{member.email}</div>
        </div>
      </OLCol>
      <OLCol xs={4} className="text-end">
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
