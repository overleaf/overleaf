import { useProjectContext } from '../../../shared/context/project-context'
import { useTranslation } from 'react-i18next'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'

export default function OwnerInfo() {
  const { t } = useTranslation()
  const { owner } = useProjectContext()

  return (
    <OLRow className="project-member">
      <OLCol xs={7}>{owner?.email}</OLCol>
      <OLCol xs={3} className="text-start">
        {t('owner')}
      </OLCol>
    </OLRow>
  )
}
