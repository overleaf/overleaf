import {
  cloneElement,
  useEffect,
  forwardRef,
  useState,
  useCallback,
} from 'react'
import {
  OverlayTrigger,
  OverlayTriggerProps,
  Tooltip as BSTooltip,
  TooltipProps as BSTooltipProps,
} from 'react-bootstrap'
import { callFnsInSequence } from '@/utils/functions'

const DEFAULT_DELAY_SHOW = 300
// Slightly lower value avoids flickering when an adjacent tooltip is shown before the previous one hides
const DEFAULT_DELAY_HIDE = 290

type OverlayProps = Omit<OverlayTriggerProps, 'overlay' | 'children'>

const UpdatingTooltip = forwardRef<HTMLDivElement, BSTooltipProps>(
  ({ popper, children, show: _, ...props }, ref) => {
    useEffect(() => {
      popper?.scheduleUpdate?.()
    }, [children, popper])

    return (
      <BSTooltip ref={ref} {...props}>
        {children}
      </BSTooltip>
    )
  }
)
UpdatingTooltip.displayName = 'UpdatingTooltip'

export type TooltipProps = {
  description: React.ReactNode
  id: string
  overlayProps?: OverlayProps
  tooltipProps?: BSTooltipProps
  hidden?: boolean
  children: React.ReactElement
}

function Tooltip({
  id,
  description,
  children,
  tooltipProps,
  overlayProps,
  hidden,
}: TooltipProps) {
  const [show, setShow] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (show && e.key === 'Escape') {
        setShow(false)
        e.stopPropagation()
      }
    },
    [show, setShow]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  const hideTooltip = (e: React.MouseEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.blur()
    }
    setShow(false)
  }

  const delay = overlayProps?.delay
  let delayShow = DEFAULT_DELAY_SHOW
  let delayHide = DEFAULT_DELAY_HIDE
  if (delay !== undefined) {
    delayShow = typeof delay === 'number' ? delay : delay.show
    delayHide = typeof delay === 'number' ? Math.max(delay - 10, 0) : delay.hide
  }

  return (
    <OverlayTrigger
      overlay={
        <UpdatingTooltip
          id={`${id}-tooltip`}
          {...tooltipProps}
          style={{ display: hidden ? 'none' : 'block' }}
        >
          {description}
        </UpdatingTooltip>
      }
      {...overlayProps}
      delay={{ show: delayShow, hide: delayHide }}
      placement={overlayProps?.placement || 'top'}
      show={show}
      onToggle={setShow}
    >
      {overlayProps?.trigger === 'click'
        ? children
        : cloneElement(children, {
            onClick: callFnsInSequence(children.props.onClick, hideTooltip),
          })}
    </OverlayTrigger>
  )
}

export default Tooltip
