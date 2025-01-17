import { useTranslation } from 'react-i18next'
import { useProjectListContext } from '../context/project-list-context'
import getMeta from '../../../utils/meta'
import classNames from 'classnames'
import OLButton from '@/features/ui/components/ol/ol-button'
import { useDsNavStyle } from '@/features/project-list/components/use-is-ds-nav'

export function useAddAffiliation() {
  const { totalProjectsCount } = useProjectListContext()
  const { isOverleaf } = getMeta('ol-ExposedSettings')
  const userAffiliations = getMeta('ol-userAffiliations') || []

  return {
    show: isOverleaf && totalProjectsCount > 0 && !userAffiliations.length,
  }
}

type AddAffiliationProps = {
  className?: string
}

function AddAffiliation({ className }: AddAffiliationProps) {
  const { t } = useTranslation()
  const { show } = useAddAffiliation()
  const dsNavStyle = useDsNavStyle()

  if (!show) {
    return null
  }

  const classes = classNames('text-center', 'add-affiliation', className)

  return (
    <div className={classes}>
      <p className={dsNavStyle ? 'text-muted' : undefined}>
        {t('are_you_affiliated_with_an_institution')}
      </p>
      <OLButton variant="secondary" href="/user/settings">
        {t('add_affiliation')}
      </OLButton>
    </div>
  )
}

export default AddAffiliation
