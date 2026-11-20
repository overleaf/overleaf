import MemberPrivileges from './member-privileges'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import ShareProjectModalRow from '@/features/share-project-modal/components/share-project-modal-row'
import MaterialIcon from '@/shared/components/material-icon'
import { ProjectMember } from '@/shared/context/types/project-metadata'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export default function ViewMember({ member }: { member: ProjectMember }) {
  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')

  return isSharingUpdatesEnabled ? (
    <ShareProjectModalRow>
      <div className="d-inline-flex align-items-center h5 m-0 gap-2">
        <MaterialIcon type="person" unfilled />
        <div className="px-2">{member.email}</div>
      </div>
      <div className="h5 m-0 px-4 fw-semibold">
        <div className="form-control-plaintext border-0">
          <MemberPrivileges
            privileges={member.privileges}
            allowCopy={member.allowCopy}
          />
        </div>
      </div>
    </ShareProjectModalRow>
  ) : (
    <OLRow className="project-member">
      <OLCol xs={8}>
        <div className="project-member-email-icon">
          <MaterialIcon type="person" />
          <div className="email-warning">{member.email}</div>
        </div>
      </OLCol>
      <OLCol xs={4} className="text-end">
        <MemberPrivileges
          privileges={member.privileges}
          allowCopy={member.allowCopy}
        />
      </OLCol>
    </OLRow>
  )
}
