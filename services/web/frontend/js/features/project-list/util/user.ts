import { UserRef } from '../../../../../types/project/dashboard/api'
import getMeta from '@/utils/meta'

export function getUserName(user: UserRef) {
  if (user?.id === getMeta('ol-user_id')) {
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
