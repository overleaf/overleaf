import { postJSON } from '@/infrastructure/fetch-json'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import Notification from '@/shared/components/notification'
import getMeta from '@/utils/meta'
import {
  ChangeEventHandler,
  ComponentProps,
  FormEvent,
  MouseEventHandler,
  useState,
} from 'react'
import { Trans, useTranslation } from 'react-i18next'
import LoadingSpinner from '@/shared/components/loading-spinner'
import { sendMB } from '@/infrastructure/event-tracking'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLButton from '@/shared/components/ol/ol-button'
import { useLocation } from '@/shared/hooks/use-location'
import DSFormLabel from '@/shared/components/ds/ds-form-label'
import DSButton from '@/shared/components/ds/ds-button'
import CIAMSixDigitsInput from '@/features/settings/components/emails/ciam-six-digits-input'
import OLFormText from '@/shared/components/ol/ol-form-text'
import DSFormText from '@/shared/components/ds/ds-form-text'
import { CaretRight } from '@phosphor-icons/react'
import DSNotification from '@/shared/components/ds/ds-notification'

type Feedback = {
  type: 'input' | 'alert'
  style: 'error' | 'info'
  message: string
}

type ConfirmEmailFormProps = {
  confirmationEndpoint: string
  flow: 'registration' | 'resend' | 'secondary'
  resendEndpoint: string
  successMessage?: React.ReactNode
  successButtonText?: string
  email?: string
  onSuccessfulConfirmation?: () => void
  interstitial: boolean
  isModal?: boolean
  onCancel?: MouseEventHandler<HTMLButtonElement>
  outerError?: string
  isCiam?: boolean
}

const OLSixDigitsInput = (props: ComponentProps<'input'>) => (
  <input
    inputMode="numeric"
    maxLength={6}
    className="form-control"
    {...props}
  />
)

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
  isCiam,
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

  const changeHandler: ChangeEventHandler<HTMLInputElement> = e => {
    setConfirmationCode(e.currentTarget.value)
    setFeedback(null)
  }

  if (!isReady) {
    return <LoadingSpinner />
  }

  if (successRedirectPath && successButtonText && successMessage) {
    return (
      <ConfirmEmailSuccessfulForm
        successMessage={successMessage}
        successButtonText={successButtonText}
        redirectTo={successRedirectPath}
        isCiam={Boolean(isCiam)}
      />
    )
  }

  const longLabel = isModal ? (
    t('enter_the_code', { email })
  ) : (
    <Trans
      i18nKey="enter_the_confirmation_code"
      components={[isCiam ? <strong /> : <span />]}
      values={{ email }}
      shouldUnescape
      tOptions={{ interpolation: { escapeValue: true } }}
    />
  )

  const Button = isCiam ? DSButton : OLButton
  const buttonSize = isCiam ? 'lg' : undefined

  const SixDigits = isCiam ? CIAMSixDigitsInput : OLSixDigitsInput
  const FormText = isCiam ? DSFormText : OLFormText

  const NotificationComponent = isCiam ? DSNotification : Notification

  const outerErrorEl = (feedback?.type === 'alert' || outerErrorDisplay) && (
    <NotificationComponent
      ariaLive="polite"
      className="confirm-email-alert"
      type={outerErrorDisplay ? 'error' : feedback!.style}
      content={outerErrorDisplay || <ErrorMessage error={feedback!.message!} />}
    />
  )

  return (
    <form
      onSubmit={submitHandler}
      onInvalid={invalidFormHandler}
      className="confirm-email-form"
      data-testid="confirm-email-form"
    >
      <div className="confirm-email-form-inner">
        {!isCiam && outerErrorEl}

        <Title
          isModal={isModal}
          interstitial={interstitial}
          isCiam={isCiam}
          outerErrorDisplay={outerErrorDisplay}
        />

        {isCiam && outerErrorEl}

        {isCiam && <p>{longLabel}</p>}

        {isCiam ? (
          <DSFormLabel htmlFor="one-time-code">
            {t('verification_code')}
          </DSFormLabel>
        ) : (
          <OLFormLabel htmlFor="one-time-code">{longLabel}</OLFormLabel>
        )}

        <SixDigits
          id="one-time-code"
          required
          value={confirmationCode}
          onChange={changeHandler}
          data-ol-dirty={feedback ? 'true' : undefined}
          autoComplete="one-time-code"
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          disabled={!!outerErrorDisplay}
        />
        <div aria-live="polite">
          {feedback?.type === 'input' && (
            <FormText type="error" marginless>
              <ErrorMessage error={feedback.message} />
            </FormText>
          )}
        </div>

        <div className="form-actions">
          <Button
            size={buttonSize}
            disabled={isResending || !!outerErrorDisplay}
            type="submit"
            isLoading={isConfirming}
            loadingLabel={t('confirming')}
          >
            {t('confirm')}
          </Button>
          <Button
            variant="secondary"
            size={buttonSize}
            disabled={isConfirming}
            onClick={resendHandler}
            isLoading={isResending}
            loadingLabel={t('resending_confirmation_code')}
          >
            {t('resend_confirmation_code')}
          </Button>
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
        {isCiam && flow === 'registration' && (
          <div className="mt-4 mb-2 text-center ">
            <Trans
              i18nKey="use_a_different_email"
              components={[
                // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
                <a
                  href="/register"
                  onClick={() =>
                    sendMB('email-verification-click', {
                      button: 'change-email',
                      flow,
                    })
                  }
                />,
              ]}
            />
          </div>
        )}
      </div>
    </form>
  )
}

function Title({
  isModal,
  interstitial,
  outerErrorDisplay,
  isCiam,
}: {
  isModal?: boolean
  interstitial: boolean
  isCiam?: boolean
  outerErrorDisplay: string | null
}) {
  const { t } = useTranslation()
  if (isCiam) return <h1>{t('verify_your_email_address')}</h1>
  if (isModal)
    return outerErrorDisplay ? (
      <div className="mt-4" />
    ) : (
      <h3 className="h5">{outerErrorDisplay ? null : t('we_sent_code')}</h3>
    )
  if (interstitial)
    return <h1 className="h3 interstitial-header">{t('confirm_your_email')}</h1>
  return <h5 className="h5">{t('confirm_your_email')}</h5>
}

function ConfirmEmailSuccessfulForm({
  successMessage,
  successButtonText,
  redirectTo,
  isCiam,
}: {
  successMessage: React.ReactNode
  successButtonText: string
  redirectTo: string
  isCiam: boolean
}) {
  const location = useLocation()
  const submitHandler = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    location.assign(redirectTo)
  }
  const button = isCiam ? (
    <DSButton
      type="submit"
      variant="primary"
      size="lg"
      className="w-100"
      trailingIcon={<CaretRight size={24} />}
    >
      {successButtonText}
    </DSButton>
  ) : (
    <OLButton type="submit" variant="primary">
      {successButtonText}
    </OLButton>
  )

  return (
    <form onSubmit={submitHandler} className="confirm-email-success-form">
      <div aria-live="polite">{successMessage}</div>

      <div className="form-actions">{button}</div>
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

    case 'email_does_not_belong_to_university':
      return <span>{t('email_does_not_belong_to_university')}</span>

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
