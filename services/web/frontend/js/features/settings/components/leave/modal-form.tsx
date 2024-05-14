import { useState, useEffect, Dispatch, SetStateAction } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { postJSON, FetchError } from '../../../../infrastructure/fetch-json'
import getMeta from '../../../../utils/meta'
import LeaveModalFormError from './modal-form-error'
import { useLocation } from '../../../../shared/hooks/use-location'
import FormGroupWrapper from '@/features/ui/components/bootstrap-5/wrappers/form-group-wrapper'
import FormLabelWrapper from '@/features/ui/components/bootstrap-5/wrappers/form-label-wrapper'
import FormControlWrapper from '@/features/ui/components/bootstrap-5/wrappers/form-control-wrapper'
import FormCheckboxWrapper from '@/features/ui/components/bootstrap-5/wrappers/form-checkbox-wrapper'

export type LeaveModalFormProps = {
  setInFlight: Dispatch<SetStateAction<boolean>>
  isFormValid: boolean
  setIsFormValid: Dispatch<SetStateAction<boolean>>
}

function LeaveModalForm({
  setInFlight,
  isFormValid,
  setIsFormValid,
}: LeaveModalFormProps) {
  const { t } = useTranslation()
  const userDefaultEmail = getMeta('ol-usersEmail') as string
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const [error, setError] = useState<FetchError | null>(null)

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value)
  }

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value)
  }

  const handleConfirmationChange = () => {
    setConfirmation(prev => !prev)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isFormValid) {
      return
    }
    setError(null)
    setInFlight(true)
    postJSON('/user/delete', {
      body: {
        password,
      },
    })
      .then(() => {
        location.assign('/')
      })
      .catch(setError)
      .finally(() => {
        setInFlight(false)
      })
  }

  useEffect(() => {
    setIsFormValid(
      !!email &&
        email.toLowerCase() === userDefaultEmail.toLowerCase() &&
        password.length > 0 &&
        confirmation
    )
  }, [setIsFormValid, userDefaultEmail, email, password, confirmation])

  return (
    <form id="leave-form" onSubmit={handleSubmit}>
      <FormGroupWrapper controlId="email-input">
        <FormLabelWrapper>{t('email')}</FormLabelWrapper>
        <FormControlWrapper
          type="text"
          placeholder={t('email')}
          required
          value={email}
          onChange={handleEmailChange}
        />
      </FormGroupWrapper>
      <FormGroupWrapper controlId="password-input">
        <FormLabelWrapper>{t('password')}</FormLabelWrapper>
        <FormControlWrapper
          type="password"
          placeholder={t('password')}
          required
          value={password}
          onChange={handlePasswordChange}
        />
      </FormGroupWrapper>
      <FormCheckboxWrapper
        id="confirm-account-deletion"
        required
        checked={confirmation}
        onChange={handleConfirmationChange}
        label={
          <Trans
            i18nKey="delete_account_confirmation_label"
            components={[<i />]} // eslint-disable-line react/jsx-key
            values={{
              userDefaultEmail,
            }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
        }
      />
      {error ? <LeaveModalFormError error={error} /> : null}
    </form>
  )
}

export default LeaveModalForm
