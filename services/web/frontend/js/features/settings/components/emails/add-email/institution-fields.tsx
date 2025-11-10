import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import CountryInput from './country-input'
import DownshiftInput from '../downshift-input'
import EmailAffiliatedWithInstitution from './email-affiliated-with-institution'
import defaultRoles from '../../../data/roles'
import defaultDepartments from '../../../data/departments'
import { CountryCode } from '../../../data/countries-list'
import { University } from '../../../../../../../types/university'
import { DomainInfo } from './input'
import { getJSON } from '../../../../../infrastructure/fetch-json'
import useAsync from '../../../../../shared/hooks/use-async'
import UniversityName from './university-name'
import OLFormGroup from '@/shared/components/ol/ol-form-group'

type InstitutionFieldsProps = {
  countryCode: CountryCode | null
  setCountryCode: React.Dispatch<React.SetStateAction<CountryCode | null>>
  universities: Partial<Record<CountryCode, University[]>>
  setUniversities: React.Dispatch<
    React.SetStateAction<Partial<Record<CountryCode, University[]>>>
  >
  universityName: string
  setUniversityName: React.Dispatch<React.SetStateAction<string>>
  role: string
  setRole: React.Dispatch<React.SetStateAction<string>>
  department: string
  setDepartment: React.Dispatch<React.SetStateAction<string>>
  newEmailMatchedDomain: DomainInfo | null
}

function InstitutionFields({
  countryCode,
  setCountryCode,
  universities,
  setUniversities,
  universityName,
  setUniversityName,
  role,
  setRole,
  department,
  setDepartment,
  newEmailMatchedDomain,
}: InstitutionFieldsProps) {
  const { t } = useTranslation()
  const countryRef = useRef<HTMLInputElement | null>(null)
  const [departments, setDepartments] = useState<string[]>([
    ...defaultDepartments,
  ])
  const [isInstitutionFieldsVisible, setIsInstitutionFieldsVisible] =
    useState(false)
  const [isUniversityDirty, setIsUniversityDirty] = useState(false)
  const { runAsync: institutionRunAsync } = useAsync<University[]>()

  useEffect(() => {
    if (isInstitutionFieldsVisible && countryRef.current) {
      countryRef.current?.focus()
    }
  }, [countryRef, isInstitutionFieldsVisible])

  useEffect(() => {
    if (universityName) {
      setIsUniversityDirty(true)
    }
  }, [setIsUniversityDirty, universityName])

  // If the institution selected by autocompletion has changed
  // hide the fields visibility and reset values
  useEffect(() => {
    if (!newEmailMatchedDomain) {
      setIsInstitutionFieldsVisible(false)
      setRole('')
      setDepartment('')
    }
  }, [newEmailMatchedDomain, setRole, setDepartment])

  useEffect(() => {
    if (newEmailMatchedDomain?.university?.departments?.length) {
      setDepartments(newEmailMatchedDomain.university.departments)
      return
    }

    // fallback if not matched on domain
    const selectedKnownUniversity = countryCode
      ? universities[countryCode]?.find(({ name }) => name === universityName)
      : undefined
    if (selectedKnownUniversity && selectedKnownUniversity.departments.length) {
      setDepartments(selectedKnownUniversity.departments)
    } else {
      setDepartments([...defaultDepartments])
    }
  }, [countryCode, universities, universityName, newEmailMatchedDomain])

  // Fetch country institution
  useEffect(() => {
    // Skip if country not selected or universities for
    // that country are already fetched
    if (!countryCode || universities[countryCode]) {
      return
    }

    institutionRunAsync(
      getJSON(`/institutions/list?country_code=${countryCode}`)
    )
      .then(data => {
        setUniversities(state => ({ ...state, [countryCode]: data }))
      })
      .catch(() => {})
  }, [countryCode, universities, setUniversities, institutionRunAsync])

  const getUniversityItems = () => {
    if (!countryCode) {
      return []
    }

    return (
      universities[countryCode]
        ?.map(({ name }) => name)
        .filter(name =>
          name.trim().toLowerCase().includes(universityName.toLowerCase())
        ) ?? []
    )
  }

  const handleShowInstitutionFields = () => {
    setIsInstitutionFieldsVisible(true)
  }

  const handleSelectUniversityManually = () => {
    setRole('')
    setDepartment('')
    handleShowInstitutionFields()
  }

  const isLetUsKnowVisible =
    !newEmailMatchedDomain && !isInstitutionFieldsVisible
  const isAutocompletedInstitutionVisible =
    newEmailMatchedDomain && !isInstitutionFieldsVisible
  const isRoleAndDepartmentVisible =
    isAutocompletedInstitutionVisible || isUniversityDirty

  // Is the email affiliated with an institution?
  if (isLetUsKnowVisible) {
    return (
      <EmailAffiliatedWithInstitution onClick={handleShowInstitutionFields} />
    )
  }

  return (
    <>
      {isAutocompletedInstitutionVisible ? (
        // Display the institution name after autocompletion
        <UniversityName
          name={newEmailMatchedDomain.university.name}
          onClick={handleSelectUniversityManually}
        />
      ) : (
        // Display the country and university fields
        <>
          <OLFormGroup className="mb-2">
            <CountryInput
              id="new-email-country-input"
              setValue={setCountryCode}
              ref={countryRef}
            />
          </OLFormGroup>
          <OLFormGroup className={isRoleAndDepartmentVisible ? 'mb-2' : 'mb-0'}>
            <DownshiftInput
              items={getUniversityItems()}
              inputValue={universityName}
              label={t('university')}
              showLabel
              setValue={setUniversityName}
              disabled={!countryCode}
            />
          </OLFormGroup>
        </>
      )}
      {isRoleAndDepartmentVisible && (
        <>
          <OLFormGroup className="mb-2">
            <DownshiftInput
              items={[...defaultRoles]}
              inputValue={role}
              label={t('role')}
              setValue={setRole}
              showLabel
            />
          </OLFormGroup>
          <OLFormGroup className="mb-0">
            <DownshiftInput
              items={departments}
              inputValue={department}
              label={t('department')}
              setValue={setDepartment}
              showLabel
            />
          </OLFormGroup>
        </>
      )}
    </>
  )
}

export default InstitutionFields
