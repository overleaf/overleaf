import { useTranslation } from 'react-i18next'
import { UserEmailData } from '../../../../../../types/user-email'
import { Button } from 'react-bootstrap'

type InstitutionAndRoleProps = {
  userEmailData: UserEmailData
}

function InstitutionAndRole({ userEmailData }: InstitutionAndRoleProps) {
  const { t } = useTranslation()
  const { affiliation } = userEmailData

  const handleAddRoleDepartment = () => {
    console.log('TODO: add role department')
  }

  const handleChangeAffiliation = () => {
    console.log('TODO: change affiliation')
  }

  if (!affiliation?.institution) {
    return null
  }

  return (
    <>
      <div>{affiliation.institution.name}</div>
      {!affiliation.department && !affiliation.role && (
        <div className="small">
          <Button className="btn-inline-link" onClick={handleAddRoleDepartment}>
            {t('add_role_and_department')}
          </Button>
        </div>
      )}
      {(affiliation.role || affiliation.department) && (
        <div className="small">
          {[affiliation.role, affiliation.department]
            .filter(Boolean)
            .join(', ')}
          <br />
          <Button className="btn-inline-link" onClick={handleChangeAffiliation}>
            {t('change')}
          </Button>
        </div>
      )}
    </>
  )
}

export default InstitutionAndRole
