import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import { useProjectListContext } from '../context/project-list-context'
import getMeta from '../../../utils/meta'
import { Affiliation } from '../../../../../types/affiliation'
import { ExposedSettings } from '../../../../../types/exposed-settings'
import classNames from 'classnames'

export function useAddAffiliation() {
  const { totalProjectsCount } = useProjectListContext()
  const { isOverleaf } = getMeta('ol-ExposedSettings') as ExposedSettings
  const userAffiliations = getMeta('ol-userAffiliations', []) as Affiliation[]

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

  if (!show) {
    return null
  }

  const classes = classNames('text-centered', 'add-affiliation', className)

  return (
    <div className={classes}>
      <p>{t('are_you_affiliated_with_an_institution')}</p>
      <Button
        bsStyle={null}
        className="btn-secondary-info btn-secondary"
        href="/user/settings"
      >
        {t('add_affiliation')}
      </Button>
    </div>
  )
}

export default AddAffiliation
