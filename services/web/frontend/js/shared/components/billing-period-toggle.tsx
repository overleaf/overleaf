import { useTranslation } from 'react-i18next'
import '../../../stylesheets/components/billing-period-toggle.scss'

export type BillingPeriod = 'monthly' | 'annual'

export type BillingPeriodToggleProps = {
  value: BillingPeriod
  onChange: (period: BillingPeriod) => void
  id?: string
  showDiscount?: boolean
  variant?: 'default' | 'premium'
}

export function BillingPeriodToggle({
  value,
  onChange,
  id = 'billing-period',
  showDiscount = true,
  variant = 'default',
}: BillingPeriodToggleProps) {
  const { t } = useTranslation()

  return (
    <fieldset
      className={`billing-period-toggle ${variant === 'premium' ? 'billing-period-toggle-premium' : ''}`}
    >
      <legend className="visually-hidden">
        {t('billing_period_sentence_case')}
      </legend>
      <input
        type="radio"
        id={`${id}-annual`}
        name={id}
        checked={value === 'annual'}
        onChange={() => {
          if (value !== 'annual') {
            onChange('annual')
          }
        }}
      />
      <label htmlFor={`${id}-annual`}>
        {t('yearly')}
        {showDiscount && (
          <span className="billing-period-toggle-discount-badge">
            {t('save_20_percent')}
          </span>
        )}
      </label>

      <input
        type="radio"
        id={`${id}-monthly`}
        name={id}
        checked={value === 'monthly'}
        onChange={() => {
          if (value !== 'monthly') {
            onChange('monthly')
          }
        }}
      />
      <label htmlFor={`${id}-monthly`}>{t('monthly')}</label>
    </fieldset>
  )
}

export default BillingPeriodToggle
