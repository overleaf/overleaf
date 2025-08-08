import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getUserFacingMessage,
  postJSON,
} from '../../../infrastructure/fetch-json'
import getMeta from '../../../utils/meta'
import useAsync from '../../../shared/hooks/use-async'
import { useUserContext } from '../../../shared/context/user-context'
import OLButton from '@/shared/components/ol/ol-button'
import OLNotification from '@/shared/components/ol/ol-notification'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormText from '@/shared/components/ol/ol-form-text'

function AccountInfoSection() {
  const { t } = useTranslation()
  const { hasAffiliationsFeature } = getMeta('ol-ExposedSettings')
  const isExternalAuthenticationSystemUsed = getMeta(
    'ol-isExternalAuthenticationSystemUsed'
  )
  const shouldAllowEditingDetails = getMeta('ol-shouldAllowEditingDetails')
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

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value)
    setIsFormValid(event.target.validity.valid)
  }

  const handleFirstNameChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFirstName(event.target.value)
  }

  const handleLastNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLastName(event.target.value)
  }

  const canUpdateEmail =
    !hasAffiliationsFeature && !isExternalAuthenticationSystemUsed
  const canUpdateNames = shouldAllowEditingDetails

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
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
      <h3 id="update-account-info">{t('update_account_info')}</h3>
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
          maxLength={255}
          handleChange={handleFirstNameChange}
          canEdit={canUpdateNames}
          required={false}
        />
        <ReadOrWriteFormGroup
          id="last-name-input"
          type="text"
          label={t('last_name')}
          maxLength={255}
          value={lastName}
          handleChange={handleLastNameChange}
          canEdit={canUpdateNames}
          required={false}
        />
        {isSuccess ? (
          <OLFormGroup>
            <OLNotification
              type="success"
              content={t('thanks_settings_updated')}
            />
          </OLFormGroup>
        ) : null}
        {isError ? (
          <OLFormGroup>
            <OLNotification
              type="error"
              content={getUserFacingMessage(error) ?? ''}
            />
          </OLFormGroup>
        ) : null}
        {canUpdateEmail || canUpdateNames ? (
          <OLFormGroup>
            <OLButton
              type="submit"
              variant="primary"
              form="account-info-form"
              disabled={!isFormValid}
              isLoading={isLoading}
              loadingLabel={t('saving') + '…'}
              aria-labelledby={isLoading ? undefined : 'update-account-info'}
            >
              {t('update')}
            </OLButton>
          </OLFormGroup>
        ) : null}
      </form>
    </>
  )
}

type ReadOrWriteFormGroupProps = {
  id: string
  type: string
  label: string
  value?: string
  handleChange: (event: any) => void
  canEdit: boolean
  maxLength?: number
  required: boolean
}

function ReadOrWriteFormGroup({
  id,
  type,
  label,
  value,
  handleChange,
  canEdit,
  maxLength,
  required,
}: ReadOrWriteFormGroupProps) {
  const [validationMessage, setValidationMessage] = useState('')

  const handleInvalid = (event: React.InvalidEvent<HTMLInputElement>) => {
    event.preventDefault()
  }

  const handleChangeAndValidity = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    handleChange(event)
    setValidationMessage(event.target.validationMessage)
  }

  if (!canEdit) {
    return (
      <OLFormGroup controlId={id}>
        <OLFormLabel>{label}</OLFormLabel>
        <OLFormControl type="text" readOnly value={value} />
      </OLFormGroup>
    )
  }

  return (
    <OLFormGroup controlId={id}>
      <OLFormLabel>{label}</OLFormLabel>
      <OLFormControl
        type={type}
        required={required}
        value={value}
        maxLength={maxLength}
        data-ol-dirty={!!validationMessage}
        onChange={handleChangeAndValidity}
        onInvalid={handleInvalid}
      />
      {validationMessage && (
        <OLFormText type="error">{validationMessage}</OLFormText>
      )}
    </OLFormGroup>
  )
}

export default AccountInfoSection
