import { Interstitial } from '@/shared/components/interstitial'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import OLButton from '@/shared/components/ol/ol-button'
import { Trans, useTranslation } from 'react-i18next'
import EmailInput from './add-email/input'
import { useState } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import { sendMB } from '@/infrastructure/event-tracking'
import { ReCaptcha2 } from '../../../../shared/components/recaptcha-2'
import { useRecaptcha } from '../../../../shared/hooks/use-recaptcha'
import { useLocation } from '@/shared/hooks/use-location'

import { postJSON } from '../../../../infrastructure/fetch-json'
import RecaptchaConditions from '@/shared/components/recaptcha-conditions'
import getMeta from '@/utils/meta'

type AddSecondaryEmailError = {
  name: string
  data: any
}

export function AddSecondaryEmailPrompt() {
  const isReady = useWaitForI18n()
  const { t } = useTranslation()
  const [email, setEmail] = useState<string>()
  const [error, setError] = useState<AddSecondaryEmailError | undefined>()
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const { ref: recaptchaRef, getReCaptchaToken } = useRecaptcha()
  const location = useLocation()

  if (!isReady) {
    return null
  }

  const onEmailChange = (newEmail: string) => {
    if (newEmail !== email) {
      setEmail(newEmail)
      setError(undefined)
    }
  }

  const errorHandler = (err: any) => {
    let errorName = 'generic_something_went_wrong'

    if (err?.response?.status === 409) {
      errorName = 'email_already_registered'
    } else if (err?.response?.status === 429) {
      errorName = 'too_many_attempts'
    } else if (
      err?.data.errorReason === 'group_domain_capture_and_managed_users_enabled'
    ) {
      errorName = 'email_already_registered_under_verified_domain'
    } else if (err?.response?.status === 422) {
      errorName = 'email_must_be_linked_to_institution'
    } else if (err?.data.errorReason === 'cannot_verify_user_not_robot') {
      errorName = 'cannot_verify_user_not_robot'
    }

    setError({ name: errorName, data: err?.data })
    sendMB('add-secondary-email-error', { errorName })
  }

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) {
      e.preventDefault()
    }

    setIsSubmitting(true)

    const token = await getReCaptchaToken()

    await postJSON('/user/emails/secondary', {
      body: {
        email,
        'g-recaptcha-response': token,
      },
    })
      .then(() => {
        location.assign('/user/emails/confirm-secondary')
      })
      .catch(errorHandler)
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  return (
    <>
      <Interstitial showLogo title={t('add_a_recovery_email_address')}>
        <form className="add-secondary-email" onSubmit={handleSubmit}>
          <ReCaptcha2 page="addEmail" recaptchaRef={recaptchaRef} />
          <p>{t('keep_your_account_safe_add_another_email')}</p>

          <EmailInput
            onChange={onEmailChange}
            handleAddNewEmail={handleSubmit}
          />

          <div aria-live="polite">
            {error && <ErrorMessage error={error} />}
          </div>

          <OLButton disabled={isSubmitting} variant="primary" type="submit">
            {isSubmitting ? <>{t('adding')}&hellip;</> : t('add_email_address')}
          </OLButton>
          <OLButton disabled={isSubmitting} variant="secondary" href="/project">
            {t('not_now')}
          </OLButton>
          <p className="add-secondary-email-learn-more">
            <Trans
              i18nKey="learn_more_about_account"
              components={[
                // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
                <a href="/learn/how-to/Keeping_your_account_secure" />,
              ]}
            />
          </p>
        </form>
      </Interstitial>
      {!getMeta('ol-ExposedSettings').recaptchaDisabled?.addEmail && (
        <div className="mt-5">
          <RecaptchaConditions />
        </div>
      )}
    </>
  )
}

function ErrorMessage({ error }: { error: AddSecondaryEmailError }) {
  const { t } = useTranslation()

  let errorText

  switch (error.name) {
    case 'email_already_registered':
      errorText = t('email_already_registered')
      break
    case 'too_many_attempts':
      errorText = t('too_many_attempts')
      break
    case 'email_must_be_linked_to_institution':
      errorText = (
        <Trans
          i18nKey="email_must_be_linked_to_institution"
          values={{ institutionName: error?.data?.institutionName }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
          components={[<a href="/account/settings" />]}
        />
      )
      break
    case 'email_already_registered_under_verified_domain':
      errorText = (
        <>
          Your company email address has been registered under a verified
          domain, and cannot be added as a secondary email. Please create a new{' '}
          <strong>Overleaf</strong> account linked to this email address.
        </>
      )
      break
    case 'cannot_verify_user_not_robot':
      errorText = t('cannot_verify_user_not_robot')
      break
    default:
      errorText = t('generic_something_went_wrong')
  }

  return (
    <div className="add-secondary-email-error small text-danger">
      <MaterialIcon className="icon" type="error" />
      <div>{errorText}</div>
    </div>
  )
}
