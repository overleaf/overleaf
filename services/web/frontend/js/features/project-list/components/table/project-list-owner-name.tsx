import { memo } from 'react'
import { useTranslation } from 'react-i18next'

export const ProjectListOwnerName = memo<{ ownerName: string }>(
  ({ ownerName }) => {
    const { t } = useTranslation()

    const x = ownerName === 'You' ? t('you') : ownerName

    return <> — {t('owned_by_x', { x })}</>
  }
)
ProjectListOwnerName.displayName = 'ProjectListOwnerName'
