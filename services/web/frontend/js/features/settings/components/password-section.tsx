import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  ControlLabel,
  FormControl,
  FormGroup,
} from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { postJSON } from '../../../infrastructure/fetch-json'
import getMeta from '../../../utils/meta'
import { ExposedSettings } from '../../../../../types/exposed-settings'
import { PasswordStrengthOptions } from '../../../../../types/password-strength-options'
import useAsync from '../../../shared/hooks/use-async'

function PasswordSection() {
  const { t } = useTranslation()

  return (
    <>
      <h3>{t('change_password')}</h3>
      <PasswordInnerSection />
    </>
  )
}

function PasswordInnerSection() {
  const { t } = useTranslation()
  const { isOverleaf } = getMeta('ol-ExposedSettings') as ExposedSettings
  const isExternalAuthenticationSystemUsed = getMeta(
    'ol-isExternalAuthenticationSystemUsed'
  ) as boolean
  const hasPassword = getMeta('ol-hasPassword') as boolean

  if (isExternalAuthenticationSystemUsed && !isOverleaf) {
    return <p>{t('password_managed_externally')}</p>
  }

  if (!hasPassword) {
    return (
      <p>
        <a href="/user/password/reset" target="_blank">
          {t('no_existing_password')}
        </a>
      </p>
    )
  }

  return <PasswordForm />
}

function PasswordForm() {
  const { t } = useTranslation()
  const passwordStrengthOptions = getMeta(
    'ol-passwordStrengthOptions'
  ) as PasswordStrengthOptions

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword1, setNewPassword1] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const { isLoading, isSuccess, isError, data, error, runAsync } = useAsync()
  const [isNewPasswordValid, setIsNewPasswordValid] = useState(false)
  const [isFormValid, setIsFormValid] = useState(false)

  const handleCurrentPasswordChange = event => {
    setCurrentPassword(event.target.value)
  }

  const handleNewPassword1Change = event => {
    setNewPassword1(event.target.value)
    setIsNewPasswordValid(event.target.validity.valid)
  }

  const handleNewPassword2Change = event => {
    setNewPassword2(event.target.value)
  }

  useEffect(() => {
    setIsFormValid(
      !!currentPassword && isNewPasswordValid && newPassword1 === newPassword2
    )
  }, [currentPassword, newPassword1, newPassword2, isNewPasswordValid])

  const handleSubmit = event => {
    event.preventDefault()
    if (!isFormValid) {
      return
    }
    runAsync(
      postJSON('/user/password/update', {
        body: {
          currentPassword,
          newPassword1,
          newPassword2,
        },
      })
    ).catch(() => {})
  }

  return (
    <form id="password-change-form" onSubmit={handleSubmit}>
      <PasswordFormGroup
        id="current-password-input"
        label={t('current_password')}
        value={currentPassword}
        handleChange={handleCurrentPasswordChange}
      />
      <PasswordFormGroup
        id="new-password-1-input"
        label={t('new_password')}
        value={newPassword1}
        handleChange={handleNewPassword1Change}
        minLength={passwordStrengthOptions?.length?.min || 6}
      />
      <PasswordFormGroup
        id="new-password-2-input"
        label={t('confirm_new_password')}
        value={newPassword2}
        handleChange={handleNewPassword2Change}
        validationMessage={
          newPassword1 !== newPassword2 ? t('doesnt_match') : ''
        }
      />
      {isSuccess && data?.message?.text ? (
        <FormGroup>
          <Alert bsStyle="success">{data.message.text}</Alert>
        </FormGroup>
      ) : null}
      {isError ? (
        <FormGroup>
          <Alert bsStyle="danger">{error.getUserFacingMessage()}</Alert>
        </FormGroup>
      ) : null}
      <Button
        form="password-change-form"
        type="submit"
        bsStyle="primary"
        disabled={isLoading || !isFormValid}
      >
        {isLoading ? <>{t('saving')}…</> : t('change')}
      </Button>
    </form>
  )
}

type PasswordFormGroupProps = {
  id: string
  label: string
  value: string
  handleChange: (event: any) => void
  minLength?: number
  validationMessage?: string
}

function PasswordFormGroup({
  id,
  label,
  value,
  handleChange,
  minLength,
  validationMessage: parentValidationMessage,
}: PasswordFormGroupProps) {
  const [validationMessage, setValidationMessage] = useState('')
  const [hadInteraction, setHadInteraction] = useState(false)

  const handleInvalid = event => {
    event.preventDefault()
  }

  const handleChangeAndValidity = event => {
    handleChange(event)
    setHadInteraction(true)
    setValidationMessage(event.target.validationMessage)
  }

  return (
    <FormGroup>
      <ControlLabel htmlFor={id}>{label}</ControlLabel>
      <FormControl
        id={id}
        type="password"
        placeholder="*********"
        value={value}
        data-ol-dirty={!!validationMessage}
        onChange={handleChangeAndValidity}
        onInvalid={handleInvalid}
        required={hadInteraction}
        minLength={minLength}
      />
      {hadInteraction && (parentValidationMessage || validationMessage) ? (
        <span className="small text-danger">
          {parentValidationMessage || validationMessage}
        </span>
      ) : null}
    </FormGroup>
  )
}

export default PasswordSection
