import { useProjectContext } from '@/shared/context/project-context'
import { useTranslation } from 'react-i18next'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import MaterialIcon from '@/shared/components/material-icon'

export default function OwnerInfo() {
  const { t } = useTranslation()
  const { project } = useProjectContext()

  return (
    <OLRow className="project-member">
      <OLCol xs={8}>
        <div className="project-member-email-icon">
          <MaterialIcon type="person" />
          <div className="email-warning">{project?.owner.email}</div>
        </div>
      </OLCol>
      <OLCol xs={4} className="text-end">
        {t('owner')}
      </OLCol>
    </OLRow>
  )
}
