import PropTypes from 'prop-types'
import { postJSON } from '../../../../../frontend/js/infrastructure/fetch-json'

function RegisterForm({
  setRegistrationSuccess,
  setEmails,
  setRegisterError,
  setFailedEmails,
}) {
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
    for (const email of emails) {
      try {
        const result = await registerUser(email)
        registeredEmails.push(result)
      } catch {
        failingEmails.push(email)
      }
    }
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
    <form onSubmit={handleRegister}>
      <div className="row">
        <div className="col-md-4 col-xs-8">
          <input
            className="form-control"
            name="email"
            type="text"
            placeholder="jane@example.com, joe@example.com"
            aria-label="emails to register"
            aria-describedby="input-details"
          />
          <p id="input-details" className="sr-only">
            Enter the emails you would like to register and separate them using
            commas
          </p>
        </div>
        <div className="col-md-8 col-xs-4">
          <button className="btn btn-primary">Register</button>
        </div>
      </div>
    </form>
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
