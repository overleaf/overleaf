import { useTranslation } from 'react-i18next'

type LoadingBrandedTypes = {
  loadProgress: number
}

export default function LoadingBranded({ loadProgress }: LoadingBrandedTypes) {
  const { t } = useTranslation()
  return (
    <div className="loading-screen-brand-container">
      <div
        className="loading-screen-brand"
        style={{ height: `${loadProgress}%` }}
      />
      <div className="h3 loading-screen-label" aria-live="polite">
        {t('loading')}
        <span className="loading-screen-ellip" aria-hidden="true">
          .
        </span>
        <span className="loading-screen-ellip" aria-hidden="true">
          .
        </span>
        <span className="loading-screen-ellip" aria-hidden="true">
          .
        </span>
      </div>
    </div>
  )
}
