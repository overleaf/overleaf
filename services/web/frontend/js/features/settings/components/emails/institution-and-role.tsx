import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { UserEmailData } from '../../../../../../types/user-email'
import { isChangingAffiliation } from '../../utils/selectors'
import { useUserEmailsContext } from '../../context/user-email-context'
import DownshiftInput from './downshift-input'
import useAsync from '../../../../shared/hooks/use-async'
import { getJSON, postJSON } from '../../../../infrastructure/fetch-json'
import defaultRoles from '../../data/roles'
import defaultDepartments from '../../data/departments'
import { University } from '../../../../../../types/university'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormGroup from '@/shared/components/ol/ol-form-group'

type InstitutionAndRoleProps = {
  userEmailData: UserEmailData
}

function InstitutionAndRole({ userEmailData }: InstitutionAndRoleProps) {
  const { t } = useTranslation()
  const { isLoading, isError, runAsync } = useAsync()
  const changeAffiliationAsync = useAsync<University>()
  const { affiliation } = userEmailData
  const {
    state,
    setLoading: setUserEmailsContextLoading,
    setEmailAffiliationBeingEdited,
    updateAffiliation,
  } = useUserEmailsContext()
  const [role, setRole] = useState(affiliation?.role || '')
  const [department, setDepartment] = useState(affiliation?.department || '')
  const [departments, setDepartments] = useState<string[]>(() => [
    ...defaultDepartments,
  ])
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
      .runAsync(getJSON(`/institutions/list/${affiliation.institution.id}`))
      .then(data => {
        if (data.departments.length) {
          setDepartments(data.departments)
        }
      })
      .catch(() => {
        setDepartments([...defaultDepartments])
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
          <OLButton
            onClick={handleChangeAffiliation}
            variant="link"
            className="btn-inline-link"
          >
            {!affiliation.department && !affiliation.role
              ? t('add_role_and_department')
              : t('change_role_and_department')}
          </OLButton>
        </div>
      ) : (
        <div className="affiliation-change-container small">
          <form onSubmit={handleSubmit}>
            <OLFormGroup className="mb-2">
              <DownshiftInput
                items={[...defaultRoles]}
                inputValue={role}
                label={t('role')}
                showLabel
                setValue={setRole}
                ref={roleRef}
              />
            </OLFormGroup>
            <OLFormGroup className="mb-2">
              <DownshiftInput
                items={departments}
                inputValue={department}
                label={t('department')}
                showLabel
                setValue={setDepartment}
              />
            </OLFormGroup>
            <OLButton
              variant="primary"
              type="submit"
              disabled={!role || !department}
              isLoading={isLoading}
              loadingLabel={t('saving')}
            >
              {t('save_or_cancel-save')}
            </OLButton>
            {!isLoading && (
              <>
                <span className="mx-1">{t('save_or_cancel-or')}</span>
                <OLButton
                  variant="link"
                  onClick={handleCancelAffiliationChange}
                  className="btn-inline-link"
                >
                  {t('save_or_cancel-cancel')}
                </OLButton>
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
