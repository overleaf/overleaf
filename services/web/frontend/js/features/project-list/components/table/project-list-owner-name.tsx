import { memo } from 'react'
import { useTranslation } from 'react-i18next'

export const ProjectListOwnerName = memo<{ ownerName: string }>(
  ({ ownerName }) => {
    const { t } = useTranslation()

    const x = ownerName === 'You' ? t('you') : ownerName

    return <span translate="no"> — {t('owned_by_x', { x })}</span>
  }
)
ProjectListOwnerName.displayName = 'ProjectListOwnerName'
