import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Row, Col } from 'react-bootstrap'
import Cell from './cell'
import useAsync from '../../../../shared/hooks/use-async'
import { useUserEmailsContext } from '../../context/user-email-context'
import { postJSON } from '../../../../infrastructure/fetch-json'
import Icon from '../../../../shared/components/icon'

const isValidEmail = (email: string) => {
  return Boolean(email)
}

function AddEmail() {
  const { t } = useTranslation()
  const [isFormVisible, setIsFormVisible] = useState(
    () => window.location.hash === '#add-email'
  )
  const [newEmail, setNewEmail] = useState('')
  const [isInstitutionFieldsVisible, setIsInstitutionFieldsVisible] =
    useState(false)
  const { isLoading, isError, runAsync } = useAsync()
  const {
    state,
    setLoading: setUserEmailsContextLoading,
    getEmails,
  } = useUserEmailsContext()

  useEffect(() => {
    setUserEmailsContextLoading(isLoading)
  }, [setUserEmailsContextLoading, isLoading])

  const handleShowAddEmailForm = () => {
    setIsFormVisible(true)
  }

  const handleShowInstitutionFields = () => {
    setIsInstitutionFieldsVisible(true)
  }

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewEmail(event.target.value)
  }

  const handleAddNewEmail = () => {
    runAsync(
      postJSON('/user/emails', {
        body: {
          email: newEmail,
        },
      })
    )
      .then(() => {
        getEmails()
        setIsFormVisible(false)
        setNewEmail('')
      })
      .catch(error => {
        console.error(error)
      })
  }

  return (
    <div className="affiliations-table-row--highlighted">
      <Row>
        {!isFormVisible ? (
          <Col md={4}>
            <Cell>
              <Button
                className="btn-inline-link"
                onClick={handleShowAddEmailForm}
              >
                {t('add_another_email')}
              </Button>
            </Cell>
          </Col>
        ) : (
          <form>
            <Col md={4}>
              <Cell>
                <label htmlFor="affiliations-email" className="sr-only">
                  {t('email')}
                </label>
                <input
                  id="affiliations-email"
                  className="form-control"
                  type="email"
                  onChange={handleEmailChange}
                  placeholder="e.g. johndoe@mit.edu"
                />
              </Cell>
            </Col>
            <Col md={4}>
              <Cell>
                {isInstitutionFieldsVisible ? (
                  <>
                    <div className="form-group mb-2">
                      <input className="form-control" />
                    </div>
                    <div className="form-group mb-0">
                      <input className="form-control" />
                    </div>
                  </>
                ) : (
                  <div className="mt-1">
                    {t('is_email_affiliated')}
                    <br />
                    <Button
                      className="btn-inline-link"
                      onClick={handleShowInstitutionFields}
                    >
                      {t('let_us_know')}
                    </Button>
                  </div>
                )}
              </Cell>
            </Col>
            <Col md={4}>
              <Cell className="text-md-right">
                <Button
                  bsSize="small"
                  bsStyle="success"
                  disabled={
                    !isValidEmail(newEmail) || isLoading || state.isLoading
                  }
                  onClick={handleAddNewEmail}
                >
                  {t('add_new_email')}
                </Button>
                {isError && (
                  <div className="text-danger small">
                    <Icon type="exclamation-triangle" fw />{' '}
                    {t('error_performing_request')}
                  </div>
                )}
              </Cell>
            </Col>
          </form>
        )}
      </Row>
    </div>
  )
}

export default AddEmail
