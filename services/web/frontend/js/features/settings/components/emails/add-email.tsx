import { useState, useEffect } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Col } from 'react-bootstrap'
import Cell from './cell'
import Layout from './add-email/layout'
import Input, { DomainInfo } from './add-email/input'
import AddAnotherEmailBtn from './add-email/add-another-email-btn'
import InstitutionFields from './add-email/institution-fields'
import SsoLinkingInfo from './add-email/sso-linking-info'
import AddNewEmailBtn from './add-email/add-new-email-btn'
import useAsync from '../../../../shared/hooks/use-async'
import { useUserEmailsContext } from '../../context/user-email-context'
import { ssoAvailableForDomain } from '../../utils/sso'
import { postJSON } from '../../../../infrastructure/fetch-json'
import { University } from '../../../../../../types/university'
import { CountryCode } from '../../data/countries-list'
import { isValidEmail } from '../../../../shared/utils/email'
import getMeta from '../../../../utils/meta'

function AddEmail() {
  const { t } = useTranslation()
  const [isFormVisible, setIsFormVisible] = useState(
    () => window.location.hash === '#add-email'
  )
  const [newEmail, setNewEmail] = useState('')
  const [newEmailMatchedDomain, setNewEmailMatchedDomain] =
    useState<DomainInfo | null>(null)
  const [countryCode, setCountryCode] = useState<CountryCode | null>(null)
  const [universities, setUniversities] = useState<
    Partial<Record<CountryCode, University[]>>
  >({})
  const [universityName, setUniversityName] = useState('')
  const [role, setRole] = useState('')
  const [department, setDepartment] = useState('')
  const { isLoading, isError, error, runAsync } = useAsync()
  const {
    state,
    setLoading: setUserEmailsContextLoading,
    getEmails,
  } = useUserEmailsContext()

  const emailAddressLimit = getMeta('ol-emailAddressLimit', 10)

  useEffect(() => {
    setUserEmailsContextLoading(isLoading)
  }, [setUserEmailsContextLoading, isLoading])

  const handleShowAddEmailForm = () => {
    setIsFormVisible(true)
  }

  const handleEmailChange = (value: string, domain?: DomainInfo) => {
    setNewEmail(value)
    setNewEmailMatchedDomain(domain || null)
  }

  const getSelectedKnownUniversityId = (): number | undefined => {
    if (countryCode) {
      return universities[countryCode]?.find(
        ({ name }) => name === universityName
      )?.id
    }

    return newEmailMatchedDomain?.university.id
  }

  const handleAddNewEmail = () => {
    const selectedKnownUniversityId = getSelectedKnownUniversityId()
    const knownUniversityData = selectedKnownUniversityId && {
      university: {
        id: selectedKnownUniversityId,
      },
      role,
      department,
    }
    const unknownUniversityData = universityName &&
      !selectedKnownUniversityId && {
        university: {
          name: universityName,
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
      })
      .catch(() => {})
  }

  if (!isFormVisible) {
    return (
      <Layout isError={isError} error={error}>
        <Col md={12}>
          <Cell>
            {state.data.emailCount >= emailAddressLimit ? (
              <span className="small">
                <Trans
                  i18nKey="email_limit_reached"
                  values={{
                    emailAddressLimit,
                  }}
                  components={[<strong />]} // eslint-disable-line react/jsx-key
                />
              </span>
            ) : (
              <AddAnotherEmailBtn onClick={handleShowAddEmailForm} />
            )}
          </Cell>
        </Col>
      </Layout>
    )
  }

  const InputComponent = (
    <>
      <label htmlFor="affiliations-email" className="sr-only">
        {t('email')}
      </label>
      <Input
        onChange={handleEmailChange}
        handleAddNewEmail={handleAddNewEmail}
      />
    </>
  )

  if (!isValidEmail(newEmail)) {
    return (
      <Layout isError={isError} error={error}>
        <form>
          <Col md={8}>
            <Cell>
              {InputComponent}
              <div className="affiliations-table-cell-tabbed">
                <div>{t('start_by_adding_your_email')}</div>
              </div>
            </Cell>
          </Col>
          <Col md={4}>
            <Cell className="text-md-right">
              <AddNewEmailBtn email={newEmail} disabled />
            </Cell>
          </Col>
        </form>
      </Layout>
    )
  }

  const isSsoAvailableForDomain =
    newEmailMatchedDomain && ssoAvailableForDomain(newEmailMatchedDomain)

  return (
    <Layout isError={isError} error={error}>
      <form>
        <Col md={8}>
          <Cell>
            {InputComponent}
            {!isSsoAvailableForDomain ? (
              <div className="affiliations-table-cell-tabbed">
                <InstitutionFields
                  countryCode={countryCode}
                  setCountryCode={setCountryCode}
                  universities={universities}
                  setUniversities={setUniversities}
                  universityName={universityName}
                  setUniversityName={setUniversityName}
                  role={role}
                  setRole={setRole}
                  department={department}
                  setDepartment={setDepartment}
                  newEmailMatchedDomain={newEmailMatchedDomain}
                />
              </div>
            ) : null}
          </Cell>
        </Col>
        {!isSsoAvailableForDomain ? (
          <Col md={4}>
            <Cell className="text-md-right">
              <AddNewEmailBtn
                email={newEmail}
                disabled={isLoading || state.isLoading}
                onClick={handleAddNewEmail}
              />
            </Cell>
          </Col>
        ) : (
          <Col md={12}>
            <Cell>
              <div className="affiliations-table-cell-tabbed">
                <SsoLinkingInfo
                  email={newEmail}
                  domainInfo={newEmailMatchedDomain as DomainInfo}
                />
              </div>
            </Cell>
          </Col>
        )}
      </form>
    </Layout>
  )
}

export default AddEmail
