import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import { postJSON } from '@/infrastructure/fetch-json'
import OLButton from '@/shared/components/ol/ol-button'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormText from '@/shared/components/ol/ol-form-text'
import OLCol from '@/shared/components/ol/ol-col'
import OLRow from '@/shared/components/ol/ol-row'
function RegisterForm({
  setRegistrationSuccess,
  setEmails,
  setRegisterError,
  setFailedEmails,
}) {
  const [isLoading, setIsLoading] = useState(false)
  const { t } = useTranslation()

  function handleRegister(event) {
    event.preventDefault()
    const formData = new FormData(event.target)
    const formDataAsEntries = formData.entries()
    const formDataAsObject = Object.fromEntries(formDataAsEntries)
    const emailString = formDataAsObject.email
    setRegistrationSuccess(false)
    setRegisterError(false)
    setEmails([])
    registerGivenUsers(parseEmails(emailString))
  }

  async function registerGivenUsers(emails) {
    const registeredEmails = []
    const failingEmails = []
    setIsLoading(true)
    for (const email of emails) {
      try {
        const result = await registerUser(email)
        registeredEmails.push(result)
      } catch {
        failingEmails.push(email)
      }
    }
    setIsLoading(false)
    if (registeredEmails.length > 0) setRegistrationSuccess(true)
    if (failingEmails.length > 0) {
      setRegisterError(true)
      setFailedEmails(failingEmails)
    }
    setEmails(registeredEmails)
  }

  function registerUser(email) {
    const options = { email }
    const url = `/admin/register`
    return postJSON(url, { body: options })
  }

  return (
    <OLForm onSubmit={handleRegister}>
      <OLRow>
        <OLCol lg={8}>
          <OLFormLabel htmlFor="register-new-user-email">
            Emails to register new users
          </OLFormLabel>
          <OLFormControl
            id="register-new-user-email"
            name="email"
            type="text"
            aria-describedby="register-new-user-email-helper"
          />
          <OLFormText id="register-new-user-email-helper">
            {t('add_comma_separated_emails_help')}
          </OLFormText>
        </OLCol>
        <OLCol
          lg={4}
          className="mt-3 mt-lg-0 d-flex align-items-center flex-column flex-lg-row"
        >
          <OLButton
            type="submit"
            isLoading={isLoading}
            loadingLabel={t('registering')}
          >
            Register
          </OLButton>
        </OLCol>
      </OLRow>
    </OLForm>
  )
}

function parseEmails(emailsText) {
  const regexBySpaceOrComma = /[\s,]+/
  let emails = emailsText.split(regexBySpaceOrComma)
  emails.map(email => email.trim())
  emails = emails.filter(email => email.indexOf('@') !== -1)
  return emails
}

RegisterForm.propTypes = {
  setRegistrationSuccess: PropTypes.func,
  setEmails: PropTypes.func,
  setRegisterError: PropTypes.func,
  setFailedEmails: PropTypes.func,
}

export default RegisterForm
