import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import classNames from 'classnames'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function Check() {
  return <MaterialIcon type="check" />
}

function UpgradeBenefits({ className }: { className?: string }) {
  const { t } = useTranslation()
  const plans2026 = useFeatureFlag('plans-2026-phase-1')

  return (
    <ul className={classNames('list-unstyled upgrade-benefits', className)}>
      <li>
        <Check />
        &nbsp;
        {plans2026 ? t('unlimited_ai') : t('unlimited_projects')}
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
