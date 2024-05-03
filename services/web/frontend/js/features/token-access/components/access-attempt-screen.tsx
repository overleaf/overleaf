import { FC } from 'react'
import { useTranslation } from 'react-i18next'

export const AccessAttemptScreen: FC<{
  loadingScreenBrandHeight: string
  inflight: boolean
  accessError: string | boolean
}> = ({ loadingScreenBrandHeight, inflight, accessError }) => {
  const { t } = useTranslation()

  return (
    <div className="loading-screen">
      <div className="loading-screen-brand-container">
        <div
          className="loading-screen-brand"
          style={{ height: loadingScreenBrandHeight }}
        />
      </div>

      <h3 className="loading-screen-label text-center">
        {t('join_project')}
        {inflight && <LoadingScreenEllipses />}
      </h3>

      {accessError && (
        <div className="global-alerts text-center">
          <div>
            <br />
            {accessError === 'not_found' ? (
              <div>
                <h4 aria-live="assertive">Project not found</h4>
              </div>
            ) : (
              <div>
                <div className="alert alert-danger" aria-live="assertive">
                  {t('token_access_failure')}
                </div>
                <p>
                  <a href="/">{t('home')}</a>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
const LoadingScreenEllipses = () => (
  <span aria-hidden>
    <span className="loading-screen-ellip">.</span>
    <span className="loading-screen-ellip">.</span>
    <span className="loading-screen-ellip">.</span>
  </span>
)
