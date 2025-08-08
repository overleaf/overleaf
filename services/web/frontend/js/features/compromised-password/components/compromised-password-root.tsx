import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import OLButton from '@/shared/components/ol/ol-button'
import { Trans, useTranslation } from 'react-i18next'
import { Interstitial } from '@/shared/components/interstitial'

export function CompromisedPasswordCard() {
  const { t } = useTranslation()
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return (
    <Interstitial
      contentClassName="compromised-password-content"
      showLogo={false}
      title={t('compromised_password')}
    >
      <p>
        <Trans
          i18nKey="your_password_was_detected"
          components={[
            /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
            <a
              href="https://haveibeenpwned.com/passwords"
              target="_blank"
              rel="noreferrer"
            />,
          ]}
        />
      </p>

      <OLButton className="btn-primary" href="/user/settings">
        {t('change_password_in_account_settings')}
      </OLButton>
    </Interstitial>
  )
}
