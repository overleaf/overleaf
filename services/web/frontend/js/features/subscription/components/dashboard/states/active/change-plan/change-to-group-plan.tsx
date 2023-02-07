import { useTranslation } from 'react-i18next'

export function ChangeToGroupPlan() {
  const { t } = useTranslation()
  return (
    <>
      <h2>{t('looking_multiple_licenses')}</h2>
      {/* todo: if/else isValidCurrencyForUpgrade and modal */}
    </>
  )
}
