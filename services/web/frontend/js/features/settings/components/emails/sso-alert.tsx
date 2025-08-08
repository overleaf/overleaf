import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import OLNotification from '@/shared/components/ol/ol-notification'

export function SSOAlert() {
  const { t } = useTranslation()

  const institutionLinked = getMeta('ol-institutionLinked')
  const institutionEmailNonCanonical = getMeta(
    'ol-institutionEmailNonCanonical'
  )
  const samlError = getMeta('ol-samlError')

  const [infoClosed, setInfoClosed] = useState(false)
  const [warningClosed, setWarningClosed] = useState(false)
  const [errorClosed, setErrorClosed] = useState(false)

  const handleInfoClosed = () => setInfoClosed(true)
  const handleWarningClosed = () => setWarningClosed(true)
  const handleErrorClosed = () => setErrorClosed(true)

  if (samlError) {
    return !errorClosed ? (
      <OLNotification
        type="error"
        content={
          <>
            {samlError.translatedMessage
              ? samlError.translatedMessage
              : samlError.message}
            {samlError.tryAgain && <p>{t('try_again')}</p>}
          </>
        }
        isDismissible
        onDismiss={handleErrorClosed}
      />
    ) : null
  }

  if (!institutionLinked) {
    return null
  }

  return (
    <>
      {!infoClosed && (
        <OLNotification
          type="info"
          content={
            <>
              <p>
                <Trans
                  i18nKey="institution_acct_successfully_linked_2"
                  components={[<strong />]} // eslint-disable-line react/jsx-key
                  values={{ institutionName: institutionLinked.universityName }}
                  shouldUnescape
                  tOptions={{ interpolation: { escapeValue: true } }}
                />
              </p>
              {institutionLinked.hasEntitlement && (
                <p>
                  <Trans
                    i18nKey="this_grants_access_to_features_2"
                    components={[<strong />]} // eslint-disable-line react/jsx-key
                    values={{ featureType: t('professional') }}
                    shouldUnescape
                    tOptions={{ interpolation: { escapeValue: true } }}
                  />
                </p>
              )}
            </>
          }
          isDismissible
          onDismiss={handleInfoClosed}
        />
      )}
      {!warningClosed && institutionEmailNonCanonical && (
        <OLNotification
          type="warning"
          content={
            <Trans
              i18nKey="in_order_to_match_institutional_metadata_2"
              components={[<strong />]} // eslint-disable-line react/jsx-key
              values={{ email: institutionEmailNonCanonical }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
          }
          isDismissible
          onDismiss={handleWarningClosed}
        />
      )}
    </>
  )
}
