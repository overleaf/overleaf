import { postJSON } from '@/infrastructure/fetch-json'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import Notification from '@/shared/components/notification'
import getMeta from '@/utils/meta'
import { FormEvent, MouseEventHandler, ReactNode, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import LoadingSpinner from '@/shared/components/loading-spinner'
import MaterialIcon from '@/shared/components/material-icon'
import { sendMB } from '@/infrastructure/event-tracking'
import OLFormLabel from '@/features/ui/components/ol/ol-form-label'
import OLButton from '@/features/ui/components/ol/ol-button'
import { useLocation } from '@/shared/hooks/use-location'

type Feedback = {
  type: 'input' | 'alert'
  style: 'error' | 'info'
  message: string
}

type ConfirmEmailFormProps = {
  confirmationEndpoint: string
  flow: string
  resendEndpoint: string
  successMessage?: React.ReactNode
  successButtonText?: string
  email?: string
  onSuccessfulConfirmation?: () => void
  interstitial: boolean
  isModal?: boolean
  onCancel?: () => void
  outerError?: string
}

export function ConfirmEmailForm({
  confirmationEndpoint,
  flow,
  resendEndpoint,
  successMessage,
  successButtonText,
  email = getMeta('ol-email'),
  onSuccessfulConfirmation,
  interstitial,
  isModal,
  onCancel,
  outerError,
}: ConfirmEmailFormProps) {
  const { t } = useTranslation()
  const [confirmationCode, setConfirmationCode] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [hasResent, setHasResent] = useState(false)
  const [successRedirectPath, setSuccessRedirectPath] = useState('')
  const { isReady } = useWaitForI18n()
  const outerErrorDisplay = (!hasResent && outerError) || null
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
      flow,
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

  const submitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsConfirming(true)
    setFeedback(null)
    sendMB('email-verification-click', {
      button: 'verify',
      flow,
    })
    try {
      const data = await postJSON(confirmationEndpoint, {
        body: { code: confirmationCode },
      })
      if (onSuccessfulConfirmation) {
        onSuccessfulConfirmation()
      } else {
        setSuccessRedirectPath(data?.redir || '/')
      }
    } catch (err) {
      errorHandler(err, 'confirm')
    } finally {
      setIsConfirming(false)
    }
  }

  const resendHandler: MouseEventHandler<HTMLButtonElement> = () => {
    setIsResending(true)
    setFeedback(null)

    postJSON(resendEndpoint)
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
        setHasResent(true)
      })

    sendMB('email-verification-click', {
      button: 'resend',
      flow,
    })
  }

  const changeHandler = (e: FormEvent<HTMLInputElement>) => {
    setConfirmationCode(e.currentTarget.value)
    setFeedback(null)
  }

  if (!isReady) {
    return <LoadingSpinner />
  }

  if (successRedirectPath && successButtonText && successMessage) {
    return (
      <ConfirmEmailSuccessfullForm
        successMessage={successMessage}
        successButtonText={successButtonText}
        redirectTo={successRedirectPath}
      />
    )
  }

  let intro: ReactNode | null = (
    <h5 className="h5">{t('confirm_your_email')}</h5>
  )
  if (isModal)
    intro = outerErrorDisplay ? (
      <div className="mt-4" />
    ) : (
      <h3 className="h5">{outerErrorDisplay ? null : t('we_sent_code')}</h3>
    )
  if (interstitial)
    intro = (
      <h1 className="h3 interstitial-header">{t('confirm_your_email')}</h1>
    )

  return (
    <form
      onSubmit={submitHandler}
      onInvalid={invalidFormHandler}
      className="confirm-email-form"
      data-testid="confirm-email-form"
    >
      <div className="confirm-email-form-inner">
        {(feedback?.type === 'alert' || outerErrorDisplay) && (
          <Notification
            ariaLive="polite"
            className="confirm-email-alert"
            type={outerErrorDisplay ? 'error' : feedback!.style}
            content={
              outerErrorDisplay || <ErrorMessage error={feedback!.message!} />
            }
          />
        )}

        {intro}

        <OLFormLabel htmlFor="one-time-code">
          {isModal
            ? t('enter_the_code', { email })
            : t('enter_the_confirmation_code', { email })}
        </OLFormLabel>
        <input
          id="one-time-code"
          className="form-control"
          inputMode="numeric"
          required
          value={confirmationCode}
          onChange={changeHandler}
          data-ol-dirty={feedback ? 'true' : undefined}
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          disabled={!!outerErrorDisplay}
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
          <OLButton
            disabled={isResending || !!outerErrorDisplay}
            type="submit"
            isLoading={isConfirming}
            loadingLabel={t('confirming')}
          >
            {t('confirm')}
          </OLButton>
          <OLButton
            variant="secondary"
            disabled={isConfirming}
            onClick={resendHandler}
            isLoading={isResending}
            loadingLabel={t('resending_confirmation_code')}
          >
            {t('resend_confirmation_code')}
          </OLButton>
          {onCancel && (
            <OLButton
              variant="danger-ghost"
              disabled={isConfirming || isResending}
              onClick={onCancel}
            >
              {t('cancel')}
            </OLButton>
          )}
        </div>
      </div>
    </form>
  )
}

function ConfirmEmailSuccessfullForm({
  successMessage,
  successButtonText,
  redirectTo,
}: {
  successMessage: React.ReactNode
  successButtonText: string
  redirectTo: string
}) {
  const location = useLocation()
  const submitHandler = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    location.assign(redirectTo)
  }

  return (
    <form onSubmit={submitHandler}>
      <div aria-live="polite">{successMessage}</div>

      <div className="form-actions">
        <OLButton type="submit" variant="primary">
          {successButtonText}
        </OLButton>
      </div>
    </form>
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
