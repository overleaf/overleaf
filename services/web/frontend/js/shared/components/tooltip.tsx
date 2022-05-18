import {
  OverlayTrigger,
  OverlayTriggerProps,
  Tooltip as BSTooltip,
} from 'react-bootstrap'

type OverlayTriggerCustomProps = {
  shouldUpdatePosition?: boolean // Not officially documented https://stackoverflow.com/a/43138470
} & OverlayTriggerProps

type TooltipProps = {
  children: React.ReactNode
  description: React.ReactNode
  id: string
  overlayProps?: Omit<OverlayTriggerCustomProps, 'overlay'>
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
