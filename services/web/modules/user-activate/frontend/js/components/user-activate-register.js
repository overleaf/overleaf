import { useState } from 'react'
import PropTypes from 'prop-types'
import RegisterForm from './register-form'
function UserActivateRegister() {
  const [emails, setEmails] = useState([])
  const [failedEmails, setFailedEmails] = useState([])
  const [registerError, setRegisterError] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)

  return (
    <div className="row">
      <div className="col-md-12">
        <div className="card">
          <div className="page-header">
            <h1> Register New Users</h1>
          </div>
          <RegisterForm
            setRegistrationSuccess={setRegistrationSuccess}
            setEmails={setEmails}
            setRegisterError={setRegisterError}
            setFailedEmails={setFailedEmails}
          />
          {registerError ? (
            <UserActivateError failedEmails={failedEmails} />
          ) : null}
          {registrationSuccess ? (
            <>
              <SuccessfulRegistrationMessage />
              <hr />
              <DisplayEmailsList emails={emails} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function UserActivateError({ failedEmails }) {
  return (
    <div className="row-spaced text-danger">
      <p>Sorry, an error occured, failed to register these emails.</p>
      {failedEmails.map(email => (
        <p key={email}>{email}</p>
      ))}
    </div>
  )
}

function SuccessfulRegistrationMessage() {
  return (
    <div className="row-spaced text-success">
      <p>We've sent out welcome emails to the registered users.</p>
      <p>
        You can also manually send them URLs below to allow them to reset their
        password and log in for the first time.
      </p>
      <p>
        (Password reset tokens will expire after one week and the user will need
        registering again).
      </p>
    </div>
  )
}

function DisplayEmailsList({ emails }) {
  return (
    <table className="table table-striped ">
      <tbody>
        <tr>
          <th>Email</th>
          <th>Set Password Url</th>
        </tr>
        {emails.map(user => (
          <tr key={user.email}>
            <td>{user.email}</td>
            <td style={{ wordBreak: 'break-all' }}>{user.setNewPasswordUrl}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

DisplayEmailsList.propTypes = {
  emails: PropTypes.array,
}
UserActivateError.propTypes = {
  failedEmails: PropTypes.array,
}

export default UserActivateRegister
