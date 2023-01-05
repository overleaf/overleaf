import type { FC, ReactNode } from 'react'
import {
  OverlayTrigger,
  OverlayTriggerProps,
  Tooltip as BSTooltip,
} from 'react-bootstrap'

type OverlayProps = Omit<OverlayTriggerProps, 'overlay'> & {
  shouldUpdatePosition?: boolean // Not officially documented https://stackoverflow.com/a/43138470
}

const Tooltip: FC<{
  description: ReactNode
  id: string
  overlayProps?: OverlayProps
  tooltipProps?: BSTooltip.TooltipProps
}> = ({ id, description, children, tooltipProps, overlayProps }) => {
  return (
    <OverlayTrigger
      overlay={
        <BSTooltip id={`${id}-tooltip`} {...tooltipProps}>
          {description}
        </BSTooltip>
      }
      {...overlayProps}
      placement={overlayProps?.placement || 'top'}
    >
      {children}
    </OverlayTrigger>
  )
}

export default Tooltip
