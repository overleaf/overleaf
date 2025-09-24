import { useTutorial } from '@/shared/hooks/promotions/use-tutorial'

import { useEditorContext } from '@/shared/context/editor-context'
import { useProjectSettingsContext } from '../editor-left-menu/context/project-settings-context'

import OLNotification from '@/shared/components/ol/ol-notification'
import getMeta from '@/utils/meta'
import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'

export const TUTORIAL_KEY = 'rolling-compile-image-changed'
const rollingImages = getMeta('ol-imageNames')
  .filter(img => img.rolling)
  .map(img => img.imageName)

const RollingCompileImageChangedAlert = () => {
  const { completeTutorial } = useTutorial(TUTORIAL_KEY)

  const { inactiveTutorials } = useEditorContext()
  const { imageName } = useProjectSettingsContext()
  const { t } = useTranslation()

  const onClose = useCallback(() => {
    completeTutorial({ event: 'promo-click', action: 'complete' })
  }, [completeTutorial])

  const onRollingBuild = imageName && rollingImages.includes(imageName)
  if (inactiveTutorials.includes(TUTORIAL_KEY) || !onRollingBuild) {
    return null
  }

  return (
    <OLNotification
      className="mt-5"
      isDismissible
      onDismiss={onClose}
      content={t('since_this_project_is_set_to_the_rolling_build')}
      type="info"
      title={t('a_new_version_of_the_rolling_texlive_build_released')}
    />
  )
}

export default RollingCompileImageChangedAlert
