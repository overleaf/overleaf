import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import getMeta from '../../../utils/meta'
import { ManagersTable } from './managers-table'

export default function InstitutionManagers() {
  const { isReady } = useWaitForI18n()
  const { t } = useTranslation()

  const groupId = getMeta('ol-groupId')
  const groupName = getMeta('ol-groupName')

  const paths = useMemo(
    () => ({
      addMember: `/manage/institutions/${groupId}/managers`,
      removeMember: `/manage/institutions/${groupId}/managers`,
    }),
    [groupId]
  )

  if (!isReady) {
    return null
  }

  return (
    <ManagersTable
      groupName={groupName}
      translations={{
        title: t('institution_account'),
        subtitle: t('managers_management'),
        remove: t('remove_manager'),
      }}
      paths={paths}
    />
  )
}
