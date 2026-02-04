import { Overlay, Popover } from 'react-bootstrap'
import Close from '@/shared/components/close'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useCallback, useEffect, useState } from 'react'
import { useSwitchEnableNewEditorState } from '../hooks/use-switch-enable-new-editor-state'
import { useEditorContext } from '@/shared/context/editor-context'
import { canUseNewEditor } from '../utils/new-editor-utils'

const TUTORIAL_KEY = 'old-editor-warning-tooltip-2'

export default function OldEditorWarningTooltip({
  target,
}: {
  target: HTMLElement | null
}) {
  const { inactiveTutorials } = useEditorContext()
  const { t } = useTranslation()
  const { loading, setEditorRedesignStatus } = useSwitchEnableNewEditorState()

  const {
    tryShowingPopup,
    showPopup,
    dismissTutorial,
    completeTutorial,
    clearPopup,
  } = useTutorial(TUTORIAL_KEY, {
    name: TUTORIAL_KEY,
  })
  const [hasShown, setHasShown] = useState(false)
  const canShow = canUseNewEditor()

  useEffect(() => {
    if (canShow && !hasShown && !inactiveTutorials.includes(TUTORIAL_KEY)) {
      tryShowingPopup('notification-prompt')
      setHasShown(true)
    }
  }, [tryShowingPopup, inactiveTutorials, hasShown, canShow])

  const onSwitch = useCallback(() => {
    completeTutorial({ event: 'notification-click', action: 'complete' })
    setEditorRedesignStatus(true)
  }, [setEditorRedesignStatus, completeTutorial])

  const closePopup = useCallback(() => {
    dismissTutorial('notification-dismiss')
    clearPopup()
  }, [dismissTutorial, clearPopup])

  if (!showPopup) {
    return null
  }

  return (
    <Overlay show placement="bottom" target={target} onHide={closePopup}>
      <Popover className="old-editor-warning-tooltip">
        <Popover.Header>
          {t('support_for_the_old_editor_is_ending_soon')}
          <Close variant="dark" onDismiss={closePopup} />
        </Popover.Header>
        <Popover.Body>
          <div>
            {t(
              'we_recommend_switching_to_the_new_editor_design_now_so_you_have_time_to_get_to_know_it'
            )}
          </div>
          <OLButton
            className="old-editor-warning-tooltip-switch-button"
            isLoading={loading}
            loadingLabel={t('loading')}
            onClick={onSwitch}
            variant="primary"
            size="sm"
          >
            {t('switch_to_new_editor_design')}
          </OLButton>
        </Popover.Body>
      </Popover>
    </Overlay>
  )
}
