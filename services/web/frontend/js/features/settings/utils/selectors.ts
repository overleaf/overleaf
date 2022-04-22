import { State } from '../context/user-email-context'
import { UserEmailData } from '../../../../../types/user-email'

export const inReconfirmNotificationPeriod = (userEmailData: UserEmailData) => {
  return userEmailData.affiliation?.inReconfirmNotificationPeriod
}

export const institutionAlreadyLinked = (
  state: State,
  userEmailData: UserEmailData
) => {
  const institutionId = userEmailData.affiliation?.institution.id?.toString()

  return institutionId !== undefined
    ? state.data.linkedInstitutionIds.includes(institutionId)
    : false
}

export const isChangingAffiliation = (
  state: State,
  email: UserEmailData['email']
) => state.data.emailAffiliationBeingEdited === email
