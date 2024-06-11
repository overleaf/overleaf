import { FC } from 'react'
import { UserRef } from '../../../../../../../types/project/dashboard/api'
import { useTranslation } from 'react-i18next'
import { getUserName } from '@/features/project-list/util/user'

export const LastUpdatedBy: FC<{
  lastUpdatedBy: UserRef
  lastUpdatedDate: string
}> = ({ lastUpdatedBy, lastUpdatedDate }) => {
  const { t } = useTranslation()

  const userName = getUserName(lastUpdatedBy)

  return (
    <>
      {t('last_updated_date_by_x', {
        lastUpdatedDate,
        person: userName === 'You' ? t('you') : userName,
      })}
    </>
  )
}
