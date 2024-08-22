import { cloneElement, useEffect, forwardRef } from 'react'
import {
  OverlayTrigger,
  OverlayTriggerProps,
  Tooltip as BSTooltip,
  TooltipProps as BSTooltipProps,
} from 'react-bootstrap-5'
import { callFnsInSequence } from '@/utils/functions'

type OverlayProps = Omit<OverlayTriggerProps, 'overlay' | 'children'>

type UpdatingTooltipProps = {
  popper: {
    scheduleUpdate: () => void
  }
  show: boolean
  [x: string]: unknown
}

const UpdatingTooltip = forwardRef<HTMLDivElement, UpdatingTooltipProps>(
  ({ popper, children, show: _, ...props }, ref) => {
    useEffect(() => {
      popper.scheduleUpdate()
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
  const delay = overlayProps?.delay
  let delayShow = 300
  let delayHide = 300
  if (delay) {
    delayShow = typeof delay === 'number' ? delay : delay.show
    delayHide = typeof delay === 'number' ? delay : delay.hide
  }

  const hideTooltip = (e: React.MouseEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.blur()
    }
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
    >
      {cloneElement(children, {
        onClick: callFnsInSequence(children.props.onClick, hideTooltip),
      })}
    </OverlayTrigger>
  )
}

export default Tooltip
