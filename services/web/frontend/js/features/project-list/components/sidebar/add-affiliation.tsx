import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import { useProjectListContext } from '../../context/project-list-context'
import getMeta from '../../../../utils/meta'
import { Affiliation } from '../../../../../../types/affiliation'
import { ExposedSettings } from '../../../../../../types/exposed-settings'

export function useAddAffiliation() {
  const { totalProjectsCount } = useProjectListContext()
  const { isOverleaf } = getMeta('ol-ExposedSettings') as ExposedSettings
  const userAffiliations = getMeta('ol-userAffiliations', []) as Affiliation[]

  return { show: isOverleaf && totalProjectsCount && !userAffiliations.length }
}

function AddAffiliation() {
  const { t } = useTranslation()
  const { show } = useAddAffiliation()

  if (!show) {
    return null
  }

  return (
    <div className="text-centered user-profile">
      <p>{t('are_you_affiliated_with_an_institution')}</p>
      <Button bsStyle="info" href="/user/settings">
        {t('add_affiliation')}
      </Button>
    </div>
  )
}

export default AddAffiliation
