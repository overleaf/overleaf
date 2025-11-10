import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useEditorContext } from '@/shared/context/editor-context'
import { useProjectContext } from '@/shared/context/project-context'
import OLNotification from '@/shared/components/ol/ol-notification'
import { useTranslation, Trans } from 'react-i18next'
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

  const content = (
    <Trans
      i18nKey="new_compiles_in_this_project_will_automatically_use_the_newest_version"
      components={[
        // eslint-disable-next-line jsx-a11y/anchor-has-content
        <a
          href="https://docs.overleaf.com/troubleshooting-and-support/tex-live#How_do_I_change_a_project%E2%80%99s_TeX_Live_version"
          target="_blank"
          key="getting-started-link"
          rel="noopener"
        />,
      ]}
    />
  )

  return (
    <OLNotification
      className="mt-5"
      isDismissible
      onDismiss={onClose}
      content={content}
      type="info"
      title={t('a_new_version_of_the_rolling_texlive_build_released')}
    />
  )
}

export default RollingCompileImageChangedAlert
