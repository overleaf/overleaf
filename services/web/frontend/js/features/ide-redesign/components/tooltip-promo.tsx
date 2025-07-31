import Close from '@/shared/components/close'
import { useEditorContext } from '@/shared/context/editor-context'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import classNames from 'classnames'
import { useCallback, useEffect } from 'react'
import { Overlay, OverlayProps, Popover } from 'react-bootstrap'

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
  const { inactiveTutorials } = useEditorContext()
  const { showPopup, tryShowingPopup, hideUntilReload, dismissTutorial } =
    useTutorial(tutorialKey, eventData)

  useEffect(() => {
    if (!inactiveTutorials.includes(tutorialKey)) {
      tryShowingPopup()
    }
  }, [tryShowingPopup, inactiveTutorials, tutorialKey])

  const isInSplitTestIfNeeded = splitTestName
    ? isSplitTestEnabled(splitTestName)
    : true

  const onHide = useCallback(() => {
    hideUntilReload()
  }, [hideUntilReload])

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
            <Close variant="dark" onDismiss={dismissTutorial} />
          </Popover.Header>
        )}

        <Popover.Body className={classNames(className)}>
          {content}
          {!header && <Close variant="dark" onDismiss={dismissTutorial} />}
        </Popover.Body>
      </Popover>
    </Overlay>
  )
}
