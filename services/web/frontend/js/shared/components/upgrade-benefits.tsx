import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import classNames from 'classnames'

function Check() {
  return <MaterialIcon type="check" />
}

function UpgradeBenefits({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <ul className={classNames('list-unstyled upgrade-benefits', className)}>
      <li>
        <Check />
        &nbsp;
        {t('unlimited_projects')}
      </li>
      <li>
        <Check />
        &nbsp;
        {t('collabs_per_proj_multiple')}
      </li>
      <li>
        <Check />
        &nbsp;
        {t('full_doc_history')}
      </li>
      <li>
        <Check />
        &nbsp;
        {t('sync_to_dropbox')}
      </li>
      <li>
        <Check />
        &nbsp;
        {t('sync_to_github')}
      </li>
      <li>
        <Check />
        &nbsp;
        {t('compile_larger_projects')}
      </li>
    </ul>
  )
}

export default memo(UpgradeBenefits)
