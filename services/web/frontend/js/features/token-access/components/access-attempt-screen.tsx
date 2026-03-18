import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import InviteNotValid from '@/features/share-project/invite-not-valid'
import getMeta from '@/utils/meta'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export const AccessAttemptScreen: FC<{
  loadingScreenBrandHeight: string
  inflight: boolean
  accessError: string | boolean
}> = ({ loadingScreenBrandHeight, inflight, accessError }) => {
  const { t } = useTranslation()
  const user = getMeta('ol-user')
  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')

  if (isSharingUpdatesEnabled) {
    if (accessError) {
      return <InviteNotValid email={user?.email} />
    }

    return (
      <div className="vertically-centered-content">
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
        </div>
      </div>
    )
  }

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
