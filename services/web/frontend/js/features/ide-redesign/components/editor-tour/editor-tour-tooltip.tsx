import { Overlay, OverlayProps, Popover } from 'react-bootstrap'
import {
  NewEditorTourStage,
  useNewEditorTourContext,
} from '../../contexts/new-editor-tour-context'
import Close from '@/shared/components/close'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'

export default function EditorTourTooltip({
  children,
  target,
  header,
  stage,
  placement,
}: {
  children: React.ReactNode
  target: HTMLElement | null
  header: string
  stage: NewEditorTourStage
  placement?: OverlayProps['placement']
}) {
  const { t } = useTranslation()
  const {
    shouldShowTourStage,
    dismissTour,
    goToNextStage,
    stageNumber,
    totalStages,
    finishTour,
  } = useNewEditorTourContext()
  const { sendEvent } = useEditorAnalytics()

  const show = shouldShowTourStage(stage)

  useEffect(() => {
    if (show) {
      sendEvent('new-editor-tour-shown', { stage: stageNumber })
    }
  }, [show, stageNumber, sendEvent])

  const isFinalStage = stageNumber === totalStages

  if (!show) {
    return null
  }

  return (
    <Overlay show placement={placement} target={target} onHide={dismissTour}>
      <Popover className="editor-tour-tooltip">
        <Popover.Header>
          {header}
          <Close variant="dark" onDismiss={dismissTour} />
        </Popover.Header>
        <Popover.Body>
          {children}
          <div className="editor-tour-tooltip-footer">
            <div>
              {stageNumber}/{totalStages}
            </div>
            {isFinalStage ? (
              <OLButton onClick={finishTour} variant="link">
                {t('finish')}
              </OLButton>
            ) : (
              <OLButton onClick={goToNextStage} variant="link">
                {t('next')}
              </OLButton>
            )}
          </div>
        </Popover.Body>
      </Popover>
    </Overlay>
  )
}
