import { FC, RefObject, useCallback, useEffect } from 'react'
import { Button, Overlay, Popover } from 'react-bootstrap'
import Close from '@/shared/components/close'

export const ReviewModePromo: FC<{
  target: RefObject<HTMLSpanElement>
  showPopup: boolean
  tryShowingPopup: () => void
  hideUntilReload: () => void
  completeTutorial: (props: {
    action: 'complete'
    event: 'promo-click' | 'promo-dismiss'
  }) => void
}> = ({
  showPopup,
  tryShowingPopup,
  hideUntilReload,
  completeTutorial,
  target,
}) => {
  useEffect(() => {
    tryShowingPopup()
  }, [tryShowingPopup])

  const handleHide = useCallback(() => {
    hideUntilReload()
  }, [hideUntilReload])

  const handleClose = useCallback(() => {
    completeTutorial({
      action: 'complete',
      event: 'promo-dismiss',
    })
  }, [completeTutorial])

  const handleAccept = useCallback(() => {
    completeTutorial({
      action: 'complete',
      event: 'promo-click',
    })
  }, [completeTutorial])

  if (!showPopup) {
    return null
  }

  return (
    <Overlay
      target={target.current}
      placement="bottom"
      show
      onHide={handleHide}
    >
      <Popover>
        <Popover.Body style={{ width: 246 }}>
          <Close variant="dark" onDismiss={handleClose} />
          <p style={{ fontWeight: 'bold' }}>Track changes have moved</p>
          <p>
            Choose <b>Reviewing</b> mode in the dropdown to turn on track
            changes.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              href="/learn/how-to/Reviewing_and_reviewers_on_Overleaf"
              target="_blank"
              size="sm"
              variant="link"
              style={{ color: 'inherit' }}
            >
              Learn more
            </Button>
            <Button onClick={handleAccept} size="sm" variant="secondary">
              OK
            </Button>
          </div>
        </Popover.Body>
      </Popover>
    </Overlay>
  )
}
