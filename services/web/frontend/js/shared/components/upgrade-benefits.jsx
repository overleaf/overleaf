import Icon from './icon'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'

function UpgradeBenefits() {
  const { t } = useTranslation()

  return (
    <ul className="list-unstyled upgrade-benefits">
      <li>
        <Icon type="check" />
        &nbsp;
        {t('unlimited_projects')}
      </li>
      <li>
        <Icon type="check" />
        &nbsp;
        {t('collabs_per_proj', { collabcount: 'Multiple' })}
      </li>
      <li>
        <Icon type="check" />
        &nbsp;
        {t('full_doc_history')}
      </li>
      <li>
        <Icon type="check" />
        &nbsp;
        {t('sync_to_dropbox')}
      </li>
      <li>
        <Icon type="check" />
        &nbsp;
        {t('sync_to_github')}
      </li>
      <li>
        <Icon type="check" />
        &nbsp;
        {t('compile_larger_projects')}
      </li>
    </ul>
  )
}

export default memo(UpgradeBenefits)
