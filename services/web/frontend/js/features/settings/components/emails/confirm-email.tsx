import { postJSON } from '@/infrastructure/fetch-json'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import Notification from '@/shared/components/notification'
import getMeta from '@/utils/meta'
import { FormEvent, useState } from 'react'
import { Button } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import LoadingSpinner from '@/shared/components/loading-spinner'
import MaterialIcon from '@/shared/components/material-icon'
import { sendMB } from '@/infrastructure/event-tracking'
import { Interstitial } from '@/shared/components/interstitial'

type Feedback = {
  type: 'input' | 'alert'
  style: 'error' | 'info'
  message: string
}

type ConfirmEmailFormProps = {
  isRegistrationForm: boolean
}

export function ConfirmEmailForm({
  isRegistrationForm,
}: ConfirmEmailFormProps) {
  const { t } = useTranslation()
  const [confirmationCode, setConfirmationCode] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [successRedirectPath, setSuccessRedirectPath] = useState('')
  const email = getMeta('ol-email')
  const { isReady } = useWaitForI18n()

  const errorHandler = (err: any, actionType?: string) => {
    let errorName = err?.data?.message?.key || 'generic_something_went_wrong'

    if (err?.response?.status === 429) {
      if (actionType === 'confirm') {
        errorName = 'too_many_confirm_code_verification_attempts'
      } else if (actionType === 'resend') {
        errorName = 'too_many_confirm_code_resend_attempts'
      }
      setFeedback({
        type: 'alert',
        style: 'error',
        message: errorName,
      })
    } else {
      setFeedback({
        type: 'input',
        style: 'error',
        message: errorName,
      })
    }

    sendMB('email-verification-error', {
      errorName,
      flow: isRegistrationForm ? 'registration' : 'secondary',
    })
  }

  const invalidFormHandler = () => {
    if (!confirmationCode) {
      return setFeedback({
        type: 'input',
        style: 'error',
        message: 'please_enter_confirmation_code',
      })
    }
  }

  const submitHandler = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsConfirming(true)
    setFeedback(null)

    const requestPath = isRegistrationForm
      ? '/registration/confirm-email'
      : '/user/emails/confirm-secondary'

    const requestBody = isRegistrationForm
      ? {
          _csrf: getMeta('ol-csrfToken'),
          code: confirmationCode,
          email,
        }
      : {
          code: confirmationCode,
        }

    postJSON(requestPath, {
      body: requestBody,
    })
      .then(data => {
        setSuccessRedirectPath(data?.redir || '/')
      })
      .catch(err => {
        errorHandler(err, 'confirm')
      })
      .finally(() => {
        setIsConfirming(false)
      })

    sendMB('email-verification-click', {
      button: 'verify',
      flow: isRegistrationForm ? 'registration' : 'secondary',
    })
  }

  const resendHandler = (e: FormEvent<Button>) => {
    setIsResending(true)
    setFeedback(null)

    const requestPath = isRegistrationForm
      ? '/registration/confirm-email/resend'
      : '/user/emails/resend-secondary-confirmation'

    const requestBody = isRegistrationForm
      ? {
          _csrf: getMeta('ol-csrfToken'),
          email,
        }
      : {}

    postJSON(requestPath, {
      body: requestBody,
    })
      .then(data => {
        setIsResending(false)
        if (data?.message?.key) {
          setFeedback({
            type: 'alert',
            style: 'info',
            message: data.message.key,
          })
        }
      })
      .catch(err => {
        errorHandler(err, 'resend')
      })
      .finally(() => {
        setIsResending(false)
      })

    sendMB('email-verification-click', {
      button: 'resend',
      flow: isRegistrationForm ? 'registration' : 'secondary',
    })
  }

  const changeHandler = (e: FormEvent<HTMLInputElement>) => {
    setConfirmationCode(e.currentTarget.value)
    setFeedback(null)
  }

  if (!isReady) {
    return (
      <Interstitial className="confirm-email" showLogo>
        <LoadingSpinner />
      </Interstitial>
    )
  }

  if (successRedirectPath) {
    return (
      <ConfirmEmailSuccessfullForm
        isRegistrationForm={isRegistrationForm}
        redirectTo={successRedirectPath}
      />
    )
  }

  return (
    <Interstitial className="confirm-email" showLogo>
      <form onSubmit={submitHandler} onInvalid={invalidFormHandler}>
        {feedback?.type === 'alert' && (
          <Notification
            ariaLive="polite"
            className="confirm-email-alert"
            type={feedback.style}
            content={<ErrorMessage error={feedback.message} />}
          />
        )}

        <h1 className="h3 interstitial-header">{t('confirm_your_email')}</h1>

        <p className="small">{t('enter_the_confirmation_code', { email })}</p>
        <input
          className="form-control"
          placeholder={t('enter_6_digit_code')}
          inputMode="numeric"
          required
          value={confirmationCode}
          onChange={changeHandler}
          data-ol-dirty={feedback ? 'true' : undefined}
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
        />
        <div aria-live="polite">
          {feedback?.type === 'input' && (
            <div className="small text-danger">
              <MaterialIcon className="icon" type="error" />
              <div>
                <ErrorMessage error={feedback.message} />
              </div>
            </div>
          )}
        </div>

        <div className="form-actions">
          <Button
            disabled={isConfirming || isResending}
            type="submit"
            bsStyle={null}
            className="btn-primary"
          >
            {isConfirming ? (
              <>
                {t('confirming')}
                <span>&hellip;</span>
              </>
            ) : (
              t('confirm')
            )}
          </Button>
          <Button
            disabled={isConfirming || isResending}
            onClick={resendHandler}
            bsStyle={null}
            className="btn-secondary"
          >
            {isResending ? (
              <>
                {t('resending_confirmation_code')}
                <span>&hellip;</span>
              </>
            ) : (
              t('resend_confirmation_code')
            )}
          </Button>
        </div>
      </form>
    </Interstitial>
  )
}

function ConfirmEmailSuccessfullForm({
  isRegistrationForm,
  redirectTo,
}: {
  isRegistrationForm: boolean
  redirectTo: string
}) {
  const { t } = useTranslation()
  const submitHandler = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    location.assign(redirectTo)
  }

  return (
    <Interstitial className="confirm-email" showLogo>
      <form onSubmit={submitHandler}>
        <div aria-live="polite">
          <h1 className="h3 interstitial-header">
            {isRegistrationForm
              ? t('email_confirmed_onboarding')
              : t('thanks_for_confirming_your_email_address')}
          </h1>
          <p className="small">
            {isRegistrationForm && (
              <Trans
                i18nKey="email_confirmed_onboarding_message"
                /* eslint-disable-next-line react/jsx-key */
                components={[<strong />]}
              />
            )}
          </p>
        </div>

        <div className="form-actions">
          <Button type="submit" bsStyle={null} className="btn-primary">
            {isRegistrationForm ? t('continue') : t('go_to_overleaf')}
          </Button>
        </div>
      </form>
    </Interstitial>
  )
}

function ErrorMessage({ error }: { error: string }) {
  const { t } = useTranslation()

  switch (error) {
    case 'invalid_confirmation_code':
      return <span>{t('invalid_confirmation_code')}</span>

    case 'expired_confirmation_code':
      return (
        <Trans
          i18nKey="expired_confirmation_code"
          /* eslint-disable-next-line react/jsx-key  */
          components={[<strong />]}
        />
      )

    case 'email_already_registered':
      return <span>{t('email_already_registered')}</span>

    case 'too_many_confirm_code_resend_attempts':
      return <span>{t('too_many_confirm_code_resend_attempts')}</span>

    case 'too_many_confirm_code_verification_attempts':
      return <span>{t('too_many_confirm_code_verification_attempts')}</span>

    case 'we_sent_new_code':
      return <span>{t('we_sent_new_code')}</span>

    case 'please_enter_confirmation_code':
      return <span>{t('please_enter_confirmation_code')}</span>

    default:
      return <span>{t('generic_something_went_wrong')}</span>
  }
}
