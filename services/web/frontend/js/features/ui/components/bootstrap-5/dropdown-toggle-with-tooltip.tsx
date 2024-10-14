import { ReactNode, forwardRef } from 'react'
import { BsPrefixRefForwardingComponent } from 'react-bootstrap-5/helpers'
import type { DropdownToggleProps } from '@/features/ui/components/types/dropdown-menu-props'
import {
  DropdownToggle as BS5DropdownToggle,
  OverlayTrigger,
  OverlayTriggerProps,
  Tooltip,
} from 'react-bootstrap-5'
import type { MergeAndOverride } from '../../../../../../types/utils'

type DropdownToggleWithTooltipProps = MergeAndOverride<
  DropdownToggleProps,
  {
    children: ReactNode
    overlayTriggerProps?: Omit<OverlayTriggerProps, 'overlay' | 'children'>
    toolTipDescription: string
    tooltipProps?: Omit<React.ComponentProps<typeof Tooltip>, 'children'>
    'aria-label'?: string
  }
>
const DropdownToggleWithTooltip = forwardRef<
  BsPrefixRefForwardingComponent<'button', DropdownToggleProps>,
  DropdownToggleWithTooltipProps
>(
  (
    {
      children,
      toolTipDescription,
      overlayTriggerProps,
      tooltipProps,
      id,
      ...toggleProps
    },
    ref
  ) => {
    return (
      <OverlayTrigger
        overlay={<Tooltip {...tooltipProps}>{toolTipDescription}</Tooltip>}
        {...overlayTriggerProps}
      >
        <BS5DropdownToggle {...toggleProps} ref={ref}>
          {children}
        </BS5DropdownToggle>
      </OverlayTrigger>
    )
  }
)

DropdownToggleWithTooltip.displayName = 'DropdownToggleWithTooltip'

export default DropdownToggleWithTooltip
