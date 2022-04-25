import { useState } from 'react'
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
import useAsync from '../../../shared/hooks/use-async'
import { useUserContext } from '../../../shared/context/user-context'

function AccountInfoSection() {
  const { t } = useTranslation()
  const { hasAffiliationsFeature } = getMeta(
    'ol-ExposedSettings'
  ) as ExposedSettings
  const isExternalAuthenticationSystemUsed = getMeta(
    'ol-isExternalAuthenticationSystemUsed'
  ) as boolean
  const shouldAllowEditingDetails = getMeta(
    'ol-shouldAllowEditingDetails'
  ) as boolean
  const {
    first_name: initialFirstName,
    last_name: initialLastName,
    email: initialEmail,
  } = useUserContext()

  const [email, setEmail] = useState(initialEmail)
  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)
  const { isLoading, isSuccess, isError, error, runAsync } = useAsync()
  const [isFormValid, setIsFormValid] = useState(true)

  const handleEmailChange = event => {
    setEmail(event.target.value)
    setIsFormValid(event.target.validity.valid)
  }

  const handleFirstNameChange = event => {
    setFirstName(event.target.value)
  }

  const handleLastNameChange = event => {
    setLastName(event.target.value)
  }

  const canUpdateEmail =
    !hasAffiliationsFeature && !isExternalAuthenticationSystemUsed
  const canUpdateNames = shouldAllowEditingDetails

  const handleSubmit = event => {
    event.preventDefault()
    if (!isFormValid) {
      return
    }
    runAsync(
      postJSON('/user/settings', {
        body: {
          email: canUpdateEmail ? email : undefined,
          first_name: canUpdateNames ? firstName : undefined,
          last_name: canUpdateNames ? lastName : undefined,
        },
      })
    ).catch(() => {})
  }

  return (
    <>
      <h3>{t('update_account_info')}</h3>
      <form id="account-info-form" onSubmit={handleSubmit}>
        {hasAffiliationsFeature ? null : (
          <ReadOrWriteFormGroup
            id="email-input"
            type="email"
            label={t('email')}
            value={email}
            handleChange={handleEmailChange}
            canEdit={canUpdateEmail}
            required
          />
        )}
        <ReadOrWriteFormGroup
          id="first-name-input"
          type="text"
          label={t('first_name')}
          value={firstName}
          handleChange={handleFirstNameChange}
          canEdit={canUpdateNames}
          required={false}
        />
        <ReadOrWriteFormGroup
          id="last-name-input"
          type="text"
          label={t('last_name')}
          value={lastName}
          handleChange={handleLastNameChange}
          canEdit={canUpdateNames}
          required={false}
        />
        {isSuccess ? (
          <FormGroup>
            <Alert bsStyle="success">{t('thanks_settings_updated')}</Alert>
          </FormGroup>
        ) : null}
        {isError ? (
          <FormGroup>
            <Alert bsStyle="danger">{error.getUserFacingMessage()}</Alert>
          </FormGroup>
        ) : null}
        {canUpdateEmail || canUpdateNames ? (
          <Button
            form="account-info-form"
            type="submit"
            bsStyle="primary"
            disabled={isLoading || !isFormValid}
          >
            {isLoading ? <>{t('saving')}…</> : t('update')}
          </Button>
        ) : null}
      </form>
    </>
  )
}

type ReadOrWriteFormGroupProps = {
  id: string
  type: string
  label: string
  value: string
  handleChange: (event: any) => void
  canEdit: boolean
  required: boolean
}

function ReadOrWriteFormGroup({
  id,
  type,
  label,
  value,
  handleChange,
  canEdit,
  required,
}: ReadOrWriteFormGroupProps) {
  const [validationMessage, setValidationMessage] = useState('')

  const handleInvalid = event => {
    event.preventDefault()
  }

  const handleChangeAndValidity = event => {
    handleChange(event)
    setValidationMessage(event.target.validationMessage)
  }

  if (!canEdit) {
    return (
      <FormGroup>
        <ControlLabel htmlFor={id}>{label}</ControlLabel>
        <FormControl id={id} type="text" readOnly value={value} />
      </FormGroup>
    )
  }

  return (
    <FormGroup>
      <ControlLabel htmlFor={id}>{label}</ControlLabel>
      <FormControl
        id={id}
        type={type}
        required={required}
        value={value}
        data-ol-dirty={!!validationMessage}
        onChange={handleChangeAndValidity}
        onInvalid={handleInvalid}
      />
      {validationMessage ? (
        <span className="small text-danger">{validationMessage}</span>
      ) : null}
    </FormGroup>
  )
}

export default AccountInfoSection
