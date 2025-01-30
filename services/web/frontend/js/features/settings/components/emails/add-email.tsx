import { useState, useEffect } from 'react'
import { useTranslation, Trans } from 'react-i18next'
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
import { ReCaptcha2 } from '../../../../shared/components/recaptcha-2'
import { useRecaptcha } from '../../../../shared/hooks/use-recaptcha'
import OLCol from '@/features/ui/components/ol/ol-col'
import { bsVersion } from '@/features/utils/bootstrap-5'
import { ConfirmEmailForm } from '@/features/settings/components/emails/confirm-email-form'

function AddEmail() {
  const { t } = useTranslation()
  const [isFormVisible, setIsFormVisible] = useState(
    () => window.location.hash === '#add-email'
  )
  const [newEmail, setNewEmail] = useState('')
  const [confirmationStep, setConfirmationStep] = useState(false)
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

  const emailAddressLimit = getMeta('ol-emailAddressLimit') || 10
  const { ref: recaptchaRef, getReCaptchaToken } = useRecaptcha()

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
      (async () => {
        const token = await getReCaptchaToken()
        await postJSON('/user/emails/secondary', {
          body: {
            email: newEmail,
            ...knownUniversityData,
            ...unknownUniversityData,
            'g-recaptcha-response': token,
          },
        })
      })()
    )
      .then(() => {
        setConfirmationStep(true)
      })
      .catch(() => {})
  }

  if (confirmationStep) {
    return (
      <ConfirmEmailForm
        confirmationEndpoint="/user/emails/confirm-secondary"
        resendEndpoint="/user/emails/resend-secondary-confirmation"
        flow="secondary"
        email={newEmail}
        onSuccessfulConfirmation={getEmails}
        interstitial={false}
        onCancel={() => {
          setConfirmationStep(false)
          setIsFormVisible(false)
        }}
      />
    )
  }

  if (!isFormVisible) {
    return (
      <Layout isError={isError} error={error}>
        <OLCol lg={12}>
          <Cell>
            {state.data.emailCount >= emailAddressLimit ? (
              <span className="small">
                <Trans
                  i18nKey="email_limit_reached"
                  values={{
                    emailAddressLimit,
                  }}
                  shouldUnescape
                  tOptions={{ interpolation: { escapeValue: true } }}
                  components={[<strong />]} // eslint-disable-line react/jsx-key
                />
              </span>
            ) : (
              <AddAnotherEmailBtn onClick={handleShowAddEmailForm} />
            )}
          </Cell>
        </OLCol>
      </Layout>
    )
  }

  const InputComponent = (
    <>
      <label
        htmlFor="affiliations-email"
        className={bsVersion({ bs5: 'visually-hidden', bs3: 'sr-only' })}
      >
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
      <form>
        <Layout isError={isError} error={error}>
          <ReCaptcha2 page="addEmail" recaptchaRef={recaptchaRef} />
          <OLCol lg={8}>
            <Cell>
              {InputComponent}
              <div className="affiliations-table-cell-tabbed">
                <div>{t('start_by_adding_your_email')}</div>
              </div>
            </Cell>
          </OLCol>
          <OLCol lg={4}>
            <Cell className="text-lg-end">
              <AddNewEmailBtn email={newEmail} disabled />
            </Cell>
          </OLCol>
        </Layout>
      </form>
    )
  }

  const isSsoAvailableForDomain =
    newEmailMatchedDomain && ssoAvailableForDomain(newEmailMatchedDomain)

  return (
    <form>
      <Layout isError={isError} error={error}>
        <ReCaptcha2 page="addEmail" recaptchaRef={recaptchaRef} />
        <OLCol lg={8}>
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
        </OLCol>
        {!isSsoAvailableForDomain ? (
          <OLCol lg={4}>
            <Cell className="text-lg-end">
              <AddNewEmailBtn
                email={newEmail}
                disabled={state.isLoading}
                isLoading={isLoading}
                onClick={handleAddNewEmail}
              />
            </Cell>
          </OLCol>
        ) : (
          <OLCol lg={12}>
            <Cell>
              <div className="affiliations-table-cell-tabbed">
                <SsoLinkingInfo
                  email={newEmail}
                  domainInfo={newEmailMatchedDomain as DomainInfo}
                />
              </div>
            </Cell>
          </OLCol>
        )}
      </Layout>
    </form>
  )
}

export default AddEmail
