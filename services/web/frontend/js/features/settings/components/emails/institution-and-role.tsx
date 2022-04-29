import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { UserEmailData } from '../../../../../../types/user-email'
import { Button } from 'react-bootstrap'
import { isChangingAffiliation } from '../../utils/selectors'
import { useUserEmailsContext } from '../../context/user-email-context'
import DownshiftInput from './downshift-input'
import useAsync from '../../../../shared/hooks/use-async'
import { getJSON, postJSON } from '../../../../infrastructure/fetch-json'
import { defaults as defaultRoles } from '../../roles'
import { defaults as defaultDepartments } from '../../departments'
import { University } from '../../../../../../types/university'

type InstitutionAndRoleProps = {
  userEmailData: UserEmailData
}

function InstitutionAndRole({ userEmailData }: InstitutionAndRoleProps) {
  const { t } = useTranslation()
  const { isLoading, isError, runAsync } = useAsync()
  const changeAffiliationAsync = useAsync()
  const { affiliation } = userEmailData
  const {
    state,
    setLoading: setUserEmailsContextLoading,
    setEmailAffiliationBeingEdited,
    updateAffiliation,
  } = useUserEmailsContext()
  const [role, setRole] = useState(affiliation?.role || '')
  const [department, setDepartment] = useState(affiliation?.department || '')
  const [departments, setDepartments] = useState(defaultDepartments)
  const roleRef = useRef<HTMLInputElement | null>(null)
  const isChangingAffiliationInProgress = isChangingAffiliation(
    state,
    userEmailData.email
  )

  useEffect(() => {
    setUserEmailsContextLoading(isLoading)
  }, [setUserEmailsContextLoading, isLoading])

  useEffect(() => {
    if (isChangingAffiliationInProgress && roleRef.current) {
      roleRef.current?.focus()
    }
  }, [roleRef, isChangingAffiliationInProgress])

  const handleChangeAffiliation = () => {
    setEmailAffiliationBeingEdited(userEmailData.email)

    if (!affiliation?.institution.id) {
      return
    }

    changeAffiliationAsync
      .runAsync<University>(
        getJSON(`/institutions/list/${affiliation.institution.id}`)
      )
      .then(data => {
        if (data.departments.length) {
          setDepartments(data.departments)
        }
      })
      .catch(() => {
        setDepartments(defaultDepartments)
      })
  }

  const handleCancelAffiliationChange = () => {
    setEmailAffiliationBeingEdited(null)
    setRole(affiliation?.role || '')
    setDepartment(affiliation?.department || '')
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    runAsync(
      postJSON('/user/emails/endorse', {
        body: {
          email: userEmailData.email,
          role,
          department,
        },
      })
    )
      .then(() => {
        updateAffiliation(userEmailData.email, role, department)
      })
      .catch(() => {})
  }

  if (!affiliation?.institution) {
    return null
  }

  return (
    <>
      <div>{affiliation.institution.name}</div>
      {!isChangingAffiliationInProgress ? (
        <div className="small">
          {(affiliation.role || affiliation.department) && (
            <>
              {[affiliation.role, affiliation.department]
                .filter(Boolean)
                .join(', ')}
              <br />
            </>
          )}
          <Button className="btn-inline-link" onClick={handleChangeAffiliation}>
            {!affiliation.department && !affiliation.role
              ? t('add_role_and_department')
              : t('change')}
          </Button>
        </div>
      ) : (
        <div className="affiliation-change-container small">
          <form onSubmit={handleSubmit}>
            <DownshiftInput
              items={defaultRoles}
              inputValue={role}
              placeholder={t('role')}
              label={t('role')}
              setValue={setRole}
              ref={roleRef}
            />
            <DownshiftInput
              items={departments}
              inputValue={department}
              placeholder={t('department')}
              label={t('department')}
              setValue={setDepartment}
            />
            <Button
              bsSize="small"
              bsStyle="success"
              type="submit"
              disabled={!role || !department || isLoading || state.isLoading}
            >
              {isLoading ? <>{t('saving')}…</> : t('save_or_cancel-save')}
            </Button>
            {!isLoading && (
              <>
                <span className="mx-1">{t('save_or_cancel-or')}</span>
                <Button
                  className="btn-inline-link"
                  onClick={handleCancelAffiliationChange}
                >
                  {t('save_or_cancel-cancel')}
                </Button>
              </>
            )}
          </form>
        </div>
      )}
      {isError && (
        <div className="text-danger small">
          {t('generic_something_went_wrong')}
        </div>
      )}
    </>
  )
}

export default InstitutionAndRole
