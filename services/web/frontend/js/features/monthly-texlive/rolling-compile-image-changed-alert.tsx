import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useEditorContext } from '@/shared/context/editor-context'
import { useProjectContext } from '@/shared/context/project-context'
import OLNotification from '@/shared/components/ol/ol-notification'
import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import { onRollingBuild } from '@/shared/utils/rolling-build'

export const TUTORIAL_KEY = 'rolling-compile-image-changed'

const RollingCompileImageChangedAlert = () => {
  const { completeTutorial } = useTutorial(TUTORIAL_KEY)
  const { project } = useProjectContext()
  const { inactiveTutorials } = useEditorContext()

  const { t } = useTranslation()

  const onClose = useCallback(() => {
    completeTutorial({ event: 'promo-click', action: 'complete' })
  }, [completeTutorial])

  if (
    inactiveTutorials.includes(TUTORIAL_KEY) ||
    !onRollingBuild(project?.imageName)
  ) {
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
