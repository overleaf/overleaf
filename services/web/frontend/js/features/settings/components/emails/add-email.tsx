import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Row, Col, Alert } from 'react-bootstrap'
import Cell from './cell'
import Icon from '../../../../shared/components/icon'
import DownshiftInput from './downshift-input'
import CountryInput from './country-input'
import { AddEmailInput, InstitutionInfo } from './add-email-input'
import useAsync from '../../../../shared/hooks/use-async'
import { useUserEmailsContext } from '../../context/user-email-context'
import { getJSON, postJSON } from '../../../../infrastructure/fetch-json'
import { defaults as defaultRoles } from '../../roles'
import { defaults as defaultDepartments } from '../../departments'
import { University } from '../../../../../../types/university'
import { CountryCode } from '../../../../../../types/country'
import { ExposedSettings } from '../../../../../../types/exposed-settings'
import getMeta from '../../../../utils/meta'
import { AddEmailSSOLinkingInfo } from './add-email-sso-linking-info'

const isValidEmail = (email: string) => {
  return Boolean(email)
}

const ssoAvailableForDomain = (domain: InstitutionInfo | null) => {
  const { hasSamlBeta, hasSamlFeature } = getMeta(
    'ol-ExposedSettings'
  ) as ExposedSettings
  if (!hasSamlFeature || !domain || !domain.confirmed || !domain.university) {
    return false
  }
  if (domain.university.ssoEnabled) {
    return true
  }
  return hasSamlBeta && domain.university.ssoBeta
}

function AddEmail() {
  const { t } = useTranslation()
  const [isFormVisible, setIsFormVisible] = useState(
    () => window.location.hash === '#add-email'
  )
  const emailRef = useRef<HTMLInputElement | null>(null)
  const countryRef = useRef<HTMLInputElement | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newEmailMatchedInstitution, setNewEmailMatchedInstitution] =
    useState<InstitutionInfo | null>(null)
  const [countryCode, setCountryCode] = useState<CountryCode | null>(null)
  const [universities, setUniversities] = useState<
    Partial<Record<CountryCode, University[]>>
  >({})
  const [university, setUniversity] = useState('')
  const [role, setRole] = useState('')
  const [department, setDepartment] = useState('')
  const [departments, setDepartments] = useState(defaultDepartments)
  const [isInstitutionFieldsVisible, setIsInstitutionFieldsVisible] =
    useState(false)
  const [isUniversityDirty, setIsUniversityDirty] = useState(false)
  const { isLoading, isError, error, runAsync } = useAsync()
  const { runAsync: institutionRunAsync } = useAsync()
  const {
    state,
    setLoading: setUserEmailsContextLoading,
    getEmails,
  } = useUserEmailsContext()

  useEffect(() => {
    setUserEmailsContextLoading(isLoading)
  }, [setUserEmailsContextLoading, isLoading])

  useEffect(() => {
    if (isFormVisible && emailRef.current) {
      emailRef.current?.focus()
    }
  }, [emailRef, isFormVisible])

  useEffect(() => {
    if (isInstitutionFieldsVisible && countryRef.current) {
      countryRef.current?.focus()
    }
  }, [countryRef, isInstitutionFieldsVisible])

  useEffect(() => {
    if (university) {
      setIsUniversityDirty(true)
    }
  }, [setIsUniversityDirty, university])

  useEffect(() => {
    const selectedKnownUniversity = countryCode
      ? universities[countryCode]?.find(({ name }) => name === university)
      : undefined

    if (selectedKnownUniversity && selectedKnownUniversity.departments.length) {
      setDepartments(selectedKnownUniversity.departments)
    } else {
      setDepartments(defaultDepartments)
    }
  }, [countryCode, universities, university])

  // Fetch country institution
  useEffect(() => {
    // Skip if country not selected or universities for
    // that country are already fetched
    if (!countryCode || universities[countryCode]) {
      return
    }

    institutionRunAsync<University[]>(
      getJSON(`/institutions/list?country_code=${countryCode}`)
    )
      .then(data => {
        setUniversities(state => ({ ...state, [countryCode]: data }))
      })
      .catch(() => {})
  }, [countryCode, universities, setUniversities, institutionRunAsync])

  const handleShowAddEmailForm = () => {
    setIsFormVisible(true)
  }

  const handleShowInstitutionFields = () => {
    setIsInstitutionFieldsVisible(true)
  }

  const handleEmailChange = (value: string, institution?: InstitutionInfo) => {
    setNewEmail(value)
    setNewEmailMatchedInstitution(institution || null)
  }

  const handleAddNewEmail = () => {
    const selectedKnownUniversity = countryCode
      ? universities[countryCode]?.find(({ name }) => name === university)
      : undefined

    const knownUniversityData = university &&
      selectedKnownUniversity && {
        university: {
          id: selectedKnownUniversity.id,
        },
        role,
        department,
      }

    const unknownUniversityData = university &&
      !selectedKnownUniversity && {
        university: {
          name: university,
          country_code: countryCode,
        },
        role,
        department,
      }

    runAsync(
      postJSON('/user/emails', {
        body: {
          email: newEmail,
          ...knownUniversityData,
          ...unknownUniversityData,
        },
      })
    )
      .then(() => {
        getEmails()
        setIsFormVisible(false)
        setNewEmail('')
        setNewEmailMatchedInstitution(null)
        setCountryCode(null)
        setIsUniversityDirty(false)
        setUniversity('')
        setRole('')
        setDepartment('')
        setIsInstitutionFieldsVisible(false)
      })
      .catch(() => {})
  }

  const getUniversityItems = () => {
    if (!countryCode) {
      return []
    }

    return universities[countryCode]?.map(({ name }) => name) ?? []
  }

  const ssoAvailable =
    newEmailMatchedInstitution &&
    ssoAvailableForDomain(newEmailMatchedInstitution)

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
                <AddEmailInput onChange={handleEmailChange} ref={emailRef} />
              </Cell>
            </Col>

            {ssoAvailable && (
              <Col md={8}>
                <Cell>
                  <AddEmailSSOLinkingInfo
                    email={newEmail}
                    institutionInfo={newEmailMatchedInstitution}
                  />
                </Cell>
              </Col>
            )}

            {!ssoAvailable && (
              <>
                <Col md={5}>
                  <Cell>
                    {isInstitutionFieldsVisible ? (
                      <>
                        <div className="form-group mb-2">
                          <CountryInput
                            id="new-email-country-input"
                            setValue={setCountryCode}
                            ref={countryRef}
                          />
                        </div>
                        <div className="form-group mb-2">
                          <DownshiftInput
                            items={getUniversityItems()}
                            inputValue={university}
                            placeholder={t('university')}
                            label={t('university')}
                            setValue={setUniversity}
                            disabled={!countryCode}
                          />
                        </div>
                        {isUniversityDirty && (
                          <>
                            <div className="form-group mb-2">
                              <DownshiftInput
                                items={defaultRoles}
                                inputValue={role}
                                placeholder={t('role')}
                                label={t('role')}
                                setValue={setRole}
                              />
                            </div>
                            <div className="form-group mb-0">
                              <DownshiftInput
                                items={departments}
                                inputValue={department}
                                placeholder={t('department')}
                                label={t('department')}
                                setValue={setDepartment}
                              />
                            </div>
                          </>
                        )}
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

                <Col md={3}>
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
                  </Cell>
                </Col>
              </>
            )}
          </form>
        )}
      </Row>
      {isError && (
        <Alert bsStyle="danger" className="text-center">
          <Icon type="exclamation-triangle" fw /> {error.getUserFacingMessage()}
        </Alert>
      )}
    </div>
  )
}

export default AddEmail
