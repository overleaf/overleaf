import { useProjectContext } from '@/shared/context/project-context'
import { useTranslation } from 'react-i18next'
import Icon from '@/shared/components/icon'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'

export default function OwnerInfo() {
  const { t } = useTranslation()
  const { owner } = useProjectContext()

  return (
    <OLRow className="project-member">
      <OLCol xs={8}>
        <div className="project-member-email-icon">
          <BootstrapVersionSwitcher
            bs3={<Icon type="user" fw />}
            bs5={<MaterialIcon type="person" />}
          />
          <div className="email-warning">{owner?.email}</div>
        </div>
      </OLCol>
      <OLCol xs={4} className="text-end">
        {t('owner')}
      </OLCol>
    </OLRow>
  )
}
