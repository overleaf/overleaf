import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useUnsavedDocsContext } from '@/features/ide-react/context/unsaved-docs-context'

export const EditingPausedBanner: FC = () => {
  const { t } = useTranslation()
  const intermittentConnectionImprovementsEnabled = useFeatureFlag(
    'intermittent-connection-improvements'
  )
  const { outOfSync } = useIdeReactContext()
  const { isLocked } = useUnsavedDocsContext()

  if (!intermittentConnectionImprovementsEnabled || (!isLocked && !outOfSync)) {
    return null
  }

  return (
    <div className="editing-paused-banner" role="alert">
      <MaterialIcon type="pause_circle" unfilled />
      <span>
        <strong>{t('editing_paused')}</strong>{' '}
        {t('been_offline_changes_saved_in_browser')}
      </span>
    </div>
  )
}
