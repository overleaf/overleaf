import { Overlay, OverlayProps } from 'react-bootstrap-5'
import {
  Overlay as BS3Overlay,
  OverlayProps as BS3OverlayProps,
} from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLOverlayProps = OverlayProps & {
  bs3Props?: BS3OverlayProps
}

function OLOverlay(props: OLOverlayProps) {
  const { bs3Props, ...bs5Props } = props

  let bs3OverlayProps: BS3OverlayProps = {
    children: bs5Props.children,
    target: bs5Props.target as BS3OverlayProps['target'],
    container: bs5Props.container,
    containerPadding: bs5Props.containerPadding,
    show: bs5Props.show,
    rootClose: bs5Props.rootClose,
    animation: bs5Props.transition,
    onHide: bs5Props.onHide as BS3OverlayProps['onHide'],
    onEnter: bs5Props.onEnter as BS3OverlayProps['onEnter'],
    onEntering: bs5Props.onEntering as BS3OverlayProps['onEntering'],
    onEntered: bs5Props.onEntered as BS3OverlayProps['onEntered'],
    onExit: bs5Props.onExit as BS3OverlayProps['onExit'],
    onExiting: bs5Props.onExiting as BS3OverlayProps['onExiting'],
    onExited: bs5Props.onExited as BS3OverlayProps['onExited'],
  }

  if (bs5Props.placement) {
    const bs3PlacementOptions = [
      'top',
      'right',
      'bottom',
      'left',
    ] satisfies Array<
      Extract<OverlayProps['placement'], BS3OverlayProps['placement']>
    >

    for (const placement of bs3PlacementOptions) {
      // BS5 has more placement options than BS3, such as "left-start", so these are mapped to "left" etc.
      if (bs5Props.placement.startsWith(placement)) {
        bs3OverlayProps.placement = placement
        break
      }
    }
  }

  bs3OverlayProps = { ...bs3OverlayProps, ...bs3Props }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Overlay {...bs3OverlayProps} />}
      bs5={<Overlay {...bs5Props} />}
    />
  )
}

export default OLOverlay
