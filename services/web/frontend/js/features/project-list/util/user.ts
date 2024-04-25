import { UserRef } from '../../../../../types/project/dashboard/api'
import { useTranslation } from 'react-i18next'

export function getUserName(user: UserRef) {
  const { t } = useTranslation()
  
  if (user?.id === window.user_id) {
    return t('you')
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
