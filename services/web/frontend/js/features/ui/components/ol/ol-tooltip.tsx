import Tooltip from '@/features/ui/components/bootstrap-5/tooltip'
import BS3Tooltip from '@/shared/components/tooltip'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLTooltipProps = React.ComponentProps<typeof Tooltip> & {
  bs3Props?: Record<string, unknown>
}

function OLTooltip(props: OLTooltipProps) {
  const { bs3Props, ...bs5Props } = props

  type BS3TooltipProps = React.ComponentProps<typeof BS3Tooltip>

  const bs3TooltipProps: BS3TooltipProps = {
    children: bs5Props.children,
    id: bs5Props.id,
    description: bs5Props.description,
    tooltipProps: bs5Props.tooltipProps as BS3TooltipProps,
    overlayProps: {
      placement: bs5Props.overlayProps?.placement,
      rootClose: bs5Props.overlayProps?.rootClose,
      trigger: bs5Props.overlayProps?.trigger,
    },
    ...bs3Props,
  }

  if ('hidden' in bs5Props) {
    bs3TooltipProps.hidden = bs5Props.hidden
  }

  const delay = bs5Props.overlayProps?.delay
  if (delay && typeof delay !== 'number') {
    bs3TooltipProps.overlayProps = {
      ...bs3TooltipProps.overlayProps,
      delayShow: delay.show,
      delayHide: delay.hide,
    }
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Tooltip {...bs3TooltipProps} />}
      bs5={<Tooltip {...bs5Props} />}
    />
  )
}

export default OLTooltip
