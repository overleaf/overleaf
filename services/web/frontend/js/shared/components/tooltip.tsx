import {
  cloneElement,
  useEffect,
  forwardRef,
  useState,
  useMemo,
  useCallback,
} from 'react'
import {
  OverlayTrigger,
  OverlayTriggerProps,
  Tooltip as BSTooltip,
  TooltipProps as BSTooltipProps,
} from 'react-bootstrap'
import { callFnsInSequence } from '@/utils/functions'
import { useTooltipContext } from '@/shared/context/tooltip-provider'

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

const chooseDelayOptions = (
  delay?: number | { show: number; hide: number }
): { show: number; hide: number } => {
  if (typeof delay === 'object') {
    return delay
  }

  if (typeof delay === 'number') {
    return {
      show: delay,
      hide: Math.max(delay - 10, 0),
    }
  }

  return {
    show: DEFAULT_DELAY_SHOW,
    hide: DEFAULT_DELAY_HIDE,
  }
}

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

  const tooltipContext = useTooltipContext()

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (show && e.key === 'Escape') {
        setShow(false)
        e.stopPropagation()
      }
    }

    document.addEventListener('keydown', listener, true)

    return () => {
      document.removeEventListener('keydown', listener, true)
    }
  }, [show])

  const hideTooltip = (e: React.MouseEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.blur()
    }
    setShow(false)
  }

  const delayProps = useMemo(() => {
    const delayOptions = chooseDelayOptions(overlayProps?.delay)
    if (tooltipContext?.isTooltipOpen) {
      delayOptions.show = 0
      delayOptions.hide = 0
    }
    return delayOptions
  }, [overlayProps?.delay, tooltipContext])

  const handleToggle = useCallback(
    (value: boolean) => {
      tooltipContext?.setIsTooltipOpen(value)
      setShow(value)
    },
    [tooltipContext]
  )

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
      delay={delayProps}
      placement={overlayProps?.placement || 'top'}
      show={show}
      onToggle={handleToggle}
      transition={!tooltipContext?.isTooltipOpen}
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
