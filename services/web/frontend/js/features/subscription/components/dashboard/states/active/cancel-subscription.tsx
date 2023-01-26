import { useTranslation } from 'react-i18next'

export function CancelSubscription() {
  const { t } = useTranslation()
  return (
    <div className="text-center">
      <p>
        <strong>{t('wed_love_you_to_stay')}</strong>
      </p>
      {/* todo: showExtendFreeTrial */}
      {/* todo: showDowngrade */}
      {/* todo: showBasicCancel */}
    </div>
  )
}
