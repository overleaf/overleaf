import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { UserEmailData } from '../../../../../../types/user-email'
import { Button } from 'react-bootstrap'
import { isChangingAffiliation } from '../../utils/selectors'
import { useUserEmailsContext } from '../../context/user-email-context'
import DownshiftInput from './downshift-input'
import Icon from '../../../../shared/components/icon'
import useAsync from '../../../../shared/hooks/use-async'
import { postJSON } from '../../../../infrastructure/fetch-json'
import { defaults as roles } from '../../roles'
import { defaults as departments } from '../../departments'

type InstitutionAndRoleProps = {
  userEmailData: UserEmailData
}

function InstitutionAndRole({ userEmailData }: InstitutionAndRoleProps) {
  const { t } = useTranslation()
  const { isLoading, isError, runAsync } = useAsync()
  const { affiliation } = userEmailData
  const {
    state,
    setLoading: setUserEmailsContextLoading,
    setEmailAffiliationBeingEdited,
    updateAffiliation,
  } = useUserEmailsContext()
  const [role, setRole] = useState(affiliation?.role || '')
  const [department, setDepartment] = useState(affiliation?.department || '')

  useEffect(() => {
    setUserEmailsContextLoading(isLoading)
  }, [setUserEmailsContextLoading, isLoading])

  const handleChangeAffiliation = () => {
    setEmailAffiliationBeingEdited(userEmailData.email)
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
      {!isChangingAffiliation(state, userEmailData.email) ? (
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
              items={roles}
              inputValue={role}
              placeholder={t('role')}
              setValue={setRole}
            />
            <DownshiftInput
              items={departments}
              inputValue={department}
              placeholder={t('department')}
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
                <span className="mx-2">{t('save_or_cancel-or')}</span>
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
        <span className="text-danger small">
          <Icon type="exclamation-triangle" fw />{' '}
          {t('error_performing_request')}
        </span>
      )}
    </>
  )
}

export default InstitutionAndRole
