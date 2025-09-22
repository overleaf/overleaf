export type UsedLatex = 'never' | 'occasionally' | 'often' | 'aware'
export type Occupation =
  | 'university'
  | 'company'
  | 'nonprofitngo'
  | 'government'
  | 'other'

export type OnboardingFormData = {
  firstName: string
  lastName: string
  primaryOccupation: Occupation | null
  usedLatex: UsedLatex | null
  companyDivisionDepartment: string
  companyJobTitle: string
  governmentJobTitle: string
  institutionName: string
  otherJobTitle: string
  nonprofitDivisionDepartment: string
  nonprofitJobTitle: string
  role: string
  subjectArea: string
  updatedAt?: Date
  shouldReceiveUpdates?: boolean
}
