import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import { Button } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'

export function CompromisedPasswordCard() {
  const { t } = useTranslation()
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return (
    <div className="compromised-password">
      <div>
        <h3 className="compromised-password-header">
          {t('compromised_password')}
        </h3>
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
      </div>

      <Button className="btn-primary" href="/user/settings">
        {t('change_password_in_account_settings')}
      </Button>
    </div>
  )
}
