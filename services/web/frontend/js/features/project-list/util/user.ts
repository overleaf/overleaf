import { UserRef } from '../../../../../types/project/dashboard/api'

export function getUserName(user: UserRef) {
  if (user?.id === window.user_id) {
    return 'You'
  }

  if (user) {
    const { firstName, lastName, email } = user

    if (firstName || lastName) {
      return [firstName, lastName].filter(n => n != null).join(' ')
    }

    if (email) {
      return email
    }
  }

  return 'None'
}
