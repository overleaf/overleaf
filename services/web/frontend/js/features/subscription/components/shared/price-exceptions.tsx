import { useTranslation } from 'react-i18next'

export function PriceExceptions() {
  const { t } = useTranslation()
  return (
    <>
      <p>
        <i>* {t('subject_to_additional_vat')}</i>
      </p>
      {/* TODO: activeCoupons */}
    </>
  )
}
