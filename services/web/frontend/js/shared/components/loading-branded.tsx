import { useTranslation } from 'react-i18next'

type LoadingBrandedTypes = {
  loadProgress: number // Percentage
  label?: string
  error?: string | null
}

export default function LoadingBranded({
  loadProgress,
  label,
  error,
}: LoadingBrandedTypes) {
  const { t } = useTranslation()
  return (
    <div className="loading-screen-brand-container">
      <div
        className="loading-screen-brand"
        style={{ height: `${loadProgress}%` }}
      />
      {error ? (
        <p className="loading-screen-error">{error}</p>
      ) : (
        <div className="h3 loading-screen-label" aria-live="polite">
          {label || t('loading')}
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
      )}
    </div>
  )
}
