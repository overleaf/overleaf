import MemberPrivileges from './member-privileges'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'
import MaterialIcon from '@/shared/components/material-icon'
import { ProjectContextMember } from '@/shared/context/types/project-context'

export default function ViewMember({
  member,
}: {
  member: ProjectContextMember
}) {
  return (
    <OLRow className="project-member">
      <OLCol xs={8}>
        <div className="project-member-email-icon">
          <MaterialIcon type="person" />
          <div className="email-warning">{member.email}</div>
        </div>
      </OLCol>
      <OLCol xs={4} className="text-end">
        <MemberPrivileges privileges={member.privileges} />
      </OLCol>
    </OLRow>
  )
}
