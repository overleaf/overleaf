import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Alert } from 'react-bootstrap'
import Icon from '../../../../shared/components/icon'
import getMeta from '../../../../utils/meta'

type InstitutionLink = {
  universityName: string
  hasEntitlement?: boolean
}

type SAMLError = {
  translatedMessage?: string
  message?: string
  tryAgain?: boolean
}

export function SSOAlert() {
  const { t } = useTranslation()

  const institutionLinked: InstitutionLink | undefined = getMeta(
    'ol-institutionLinked'
  )
  const institutionEmailNonCanonical: string | undefined = getMeta(
    'ol-institutionEmailNonCanonical'
  )
  const samlError: SAMLError | undefined = getMeta('ol-samlError')

  const [infoClosed, setInfoClosed] = useState(false)
  const [warningClosed, setWarningClosed] = useState(false)
  const [errorClosed, setErrorClosed] = useState(false)

  const handleInfoClosed = () => setInfoClosed(true)
  const handleWarningClosed = () => setWarningClosed(true)
  const handleErrorClosed = () => setErrorClosed(true)

  if (samlError) {
    return (
      !errorClosed && (
        <Alert bsStyle="danger" onDismiss={handleErrorClosed}>
          <p className="text-center">
            <Icon
              type="exclamation-triangle"
              accessibilityLabel={t('generic_something_went_wrong')}
            />{' '}
            {samlError.translatedMessage
              ? samlError.translatedMessage
              : samlError.message}
          </p>
          {samlError.tryAgain && (
            <p className="text-center">{t('try_again')}</p>
          )}
        </Alert>
      )
    )
  }

  if (!institutionLinked) {
    return null
  }

  return (
    <>
      {!infoClosed && (
        <Alert bsStyle="info" onDismiss={handleInfoClosed}>
          <p className="text-center">
            <Trans
              i18nKey="institution_acct_successfully_linked_2"
              components={[<strong />]} // eslint-disable-line react/jsx-key
              values={{ institutionName: institutionLinked.universityName }}
            />
          </p>
          {institutionLinked.hasEntitlement && (
            <p className="text-center">
              <Trans
                i18nKey="this_grants_access_to_features_2"
                components={[<strong />]} // eslint-disable-line react/jsx-key
                values={{ featureType: t('professional') }}
              />
            </p>
          )}
        </Alert>
      )}
      {!warningClosed && institutionEmailNonCanonical && (
        <Alert bsStyle="warning" onDismiss={handleWarningClosed}>
          <p className="text-center">
            <Icon
              type="exclamation-triangle"
              accessibilityLabel={t('generic_something_went_wrong')}
            />{' '}
            <Trans
              i18nKey="in_order_to_match_institutional_metadata_2"
              components={[<strong />]} // eslint-disable-line react/jsx-key
              values={{ email: institutionEmailNonCanonical }}
            />
          </p>
        </Alert>
      )}
    </>
  )
}
