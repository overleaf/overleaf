import { cloneElement } from 'react'
import {
  OverlayTrigger,
  OverlayTriggerProps,
  Tooltip as BSTooltip,
} from 'react-bootstrap'
import { callFnsInSequence } from '../../utils/functions'

type OverlayProps = Omit<OverlayTriggerProps, 'overlay'> & {
  shouldUpdatePosition?: boolean // Not officially documented https://stackoverflow.com/a/43138470
}

export type TooltipProps = {
  description: React.ReactNode
  id: string
  overlayProps?: OverlayProps
  tooltipProps?: BSTooltip.TooltipProps
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
  const hideTooltip = (e: React.MouseEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.blur()
    }
  }

  return (
    <OverlayTrigger
      overlay={
        <BSTooltip
          id={`${id}-tooltip`}
          {...tooltipProps}
          style={{ display: hidden ? 'none' : 'block' }}
        >
          {description}
        </BSTooltip>
      }
      {...overlayProps}
      placement={overlayProps?.placement || 'top'}
    >
      {cloneElement(children, {
        onClick: callFnsInSequence(children.props.onClick, hideTooltip),
      })}
    </OverlayTrigger>
  )
}

export default Tooltip
