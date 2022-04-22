import {
  Actions,
  ActionSetData,
  ActionSetLoading,
  ActionMakePrimary,
  ActionDeleteEmail,
  ActionSetEmailAffiliationBeingEdited,
  ActionUpdateAffiliation,
} from '../context/user-email-context'
import { UserEmailData } from '../../../../../types/user-email'
import { Nullable } from '../../../../../types/utils'
import { Affiliation } from '../../../../../types/affiliation'

export const setData = (data: UserEmailData[]): ActionSetData => ({
  type: Actions.SET_DATA,
  payload: data,
})

export const setLoading = (flag: boolean): ActionSetLoading => ({
  type: Actions.SET_LOADING_STATE,
  payload: flag,
})

export const makePrimary = (
  email: UserEmailData['email']
): ActionMakePrimary => ({
  type: Actions.MAKE_PRIMARY,
  payload: email,
})

export const deleteEmail = (
  email: UserEmailData['email']
): ActionDeleteEmail => ({
  type: Actions.DELETE_EMAIL,
  payload: email,
})

export const setEmailAffiliationBeingEdited = (
  email: Nullable<UserEmailData['email']>
): ActionSetEmailAffiliationBeingEdited => ({
  type: Actions.SET_EMAIL_AFFILIATION_BEING_EDITED,
  payload: email,
})

export const updateAffiliation = (
  email: UserEmailData['email'],
  role: Affiliation['role'],
  department: Affiliation['department']
): ActionUpdateAffiliation => ({
  type: Actions.UPDATE_AFFILIATION,
  payload: { email, role, department },
})
