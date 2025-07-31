import { useState } from 'react'
import PropTypes from 'prop-types'
import { postJSON } from '@/infrastructure/fetch-json'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLForm from '@/features/ui/components/ol/ol-form'
import OLFormControl from '@/features/ui/components/ol/ol-form-control'

function RegisterForm({
  setRegistrationSuccess,
  setEmails,
  setRegisterError,
  setFailedEmails,
}) {
  const [isLoading, setIsLoading] = useState(false)
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
      <div className="d-flex gap-2 flex-wrap">
        <div className="flex-grow-1 max-width">
          <OLFormControl
            className="form-control"
            name="email"
            type="text"
            placeholder="jane@example.com, joe@example.com"
            aria-label="emails to register"
            aria-describedby="input-details"
          />
          <p id="input-details" className="visually-hidden">
            Enter the emails you would like to register and separate them using
            commas
          </p>
        </div>
        <OLButton type="submit" className="ms-auto" isLoading={isLoading}>
          Register
        </OLButton>
      </div>
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
