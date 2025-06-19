import Close from '@/shared/components/close'
import { useEditorContext } from '@/shared/context/editor-context'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useCallback, useEffect } from 'react'
import { Overlay, Popover } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

const TUTORIAL_KEY = 'new-error-logs-promo'
const EVENT_DATA = { name: 'new-error-logs-promotion' }

export default function NewErrorLogsPromo({
  target,
}: {
  target: HTMLElement | null
}) {
  const { t } = useTranslation()

  const { inactiveTutorials } = useEditorContext()
  const { showPopup, tryShowingPopup, hideUntilReload, completeTutorial } =
    useTutorial(TUTORIAL_KEY, EVENT_DATA)

  useEffect(() => {
    if (!inactiveTutorials.includes(TUTORIAL_KEY)) {
      tryShowingPopup()
    }
  }, [tryShowingPopup, inactiveTutorials])

  const onHide = useCallback(() => {
    hideUntilReload()
  }, [hideUntilReload])

  const onClose = useCallback(() => {
    completeTutorial({
      action: 'complete',
      event: 'promo-dismiss',
    })
  }, [completeTutorial])

  if (!target) {
    return null
  }

  return (
    <Overlay
      placement="right"
      show={showPopup}
      target={target}
      rootClose
      onHide={onHide}
    >
      <Popover>
        <Popover.Body className="new-error-logs-promo">
          {t('error_logs_have_had_an_update')}
          <Close variant="dark" onDismiss={onClose} />
        </Popover.Body>
      </Popover>
    </Overlay>
  )
}
