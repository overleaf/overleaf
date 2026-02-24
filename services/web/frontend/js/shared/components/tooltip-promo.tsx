import Close from '@/shared/components/close'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import classNames from 'classnames'
import { useCallback, useEffect } from 'react'
import { Overlay, OverlayProps, Popover } from 'react-bootstrap'

/** @knipignore keep this file around even when there is no current promo using it */
export default function TooltipPromotion({
  target,
  tutorialKey,
  eventData,
  className,
  content,
  header,
  placement = 'bottom',
  splitTestName,
}: {
  target: HTMLElement | null
  tutorialKey: string
  eventData: Record<string, any>
  className?: string
  content: string
  header?: string
  placement?: OverlayProps['placement']
  splitTestName?: string
}) {
  const {
    showPopup,
    tryShowingPopup,
    hideUntilReload,
    dismissTutorial,
    checkCompletion,
  } = useTutorial(tutorialKey, eventData)

  useEffect(() => {
    if (!checkCompletion()) {
      tryShowingPopup()
    }
  }, [tryShowingPopup, checkCompletion, tutorialKey])

  const isInSplitTestIfNeeded = splitTestName
    ? isSplitTestEnabled(splitTestName)
    : true

  const onHide = useCallback(() => {
    hideUntilReload()
  }, [hideUntilReload])

  const onDismiss = useCallback(() => {
    dismissTutorial()
  }, [dismissTutorial])

  if (!target || !isInSplitTestIfNeeded) {
    return null
  }

  return (
    <Overlay
      placement={placement}
      show={showPopup}
      target={target}
      rootClose
      onHide={onHide}
    >
      <Popover>
        {header && (
          <Popover.Header>
            {header}
            <Close variant="dark" onDismiss={onDismiss} />
          </Popover.Header>
        )}

        <Popover.Body className={classNames(className)}>
          {content}
          {!header && <Close variant="dark" onDismiss={onDismiss} />}
        </Popover.Body>
      </Popover>
    </Overlay>
  )
}
