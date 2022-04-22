import {
  OverlayTrigger,
  OverlayTriggerProps,
  Tooltip as BSTooltip,
} from 'react-bootstrap'

type TooltipProps = {
  children: React.ReactNode
  description: string
  id: string
  overlayProps?: Omit<OverlayTriggerProps, 'overlay'>
  tooltipProps?: BSTooltip.TooltipProps
}

function Tooltip({
  id,
  description,
  children,
  tooltipProps,
  overlayProps,
}: TooltipProps) {
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
