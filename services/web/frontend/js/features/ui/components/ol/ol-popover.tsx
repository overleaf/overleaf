import { forwardRef } from 'react'
import { Popover, PopoverProps } from 'react-bootstrap-5'
import {
  Popover as BS3Popover,
  PopoverProps as BS3PopoverProps,
} from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLPopoverProps = Omit<PopoverProps, 'title'> & {
  title?: React.ReactNode
  bs3Props?: BS3PopoverProps
}

const OLPopover = forwardRef<HTMLDivElement, OLPopoverProps>((props, ref) => {
  // BS3 passes in some props automatically so the `props`
  // type should be adjusted to reflect the actual received object
  const propsCombinedWithAutoInjectedBs3Props = props as OLPopoverProps &
    Pick<
      BS3PopoverProps,
      'arrowOffsetLeft' | 'arrowOffsetTop' | 'positionLeft' | 'positionTop'
    >

  const {
    bs3Props,
    title,
    children,
    arrowOffsetLeft,
    arrowOffsetTop,
    positionLeft,
    positionTop,
    ...bs5Props
  } = propsCombinedWithAutoInjectedBs3Props

  let bs3PopoverProps: BS3PopoverProps = {
    children,
    arrowOffsetLeft,
    arrowOffsetTop,
    positionLeft,
    positionTop,
    title,
    id: bs5Props.id,
    className: bs5Props.className,
    style: bs5Props.style,
  }

  if (bs5Props.placement) {
    const bs3PlacementOptions = [
      'top',
      'right',
      'bottom',
      'left',
    ] satisfies Array<
      Extract<PopoverProps['placement'], BS3PopoverProps['placement']>
    >

    for (const placement of bs3PlacementOptions) {
      if (placement === bs5Props.placement) {
        bs3PopoverProps.placement = bs5Props.placement
        break
      }
    }
  }

  bs3PopoverProps = { ...bs3PopoverProps, ...bs3Props }

  return (
    <BootstrapVersionSwitcher
      bs3={
        <BS3Popover
          {...bs3PopoverProps}
          ref={ref as React.LegacyRef<BS3Popover>}
        />
      }
      bs5={
        <Popover {...bs5Props} ref={ref}>
          {title && <Popover.Header>{title}</Popover.Header>}
          <Popover.Body>{children}</Popover.Body>
        </Popover>
      }
    />
  )
})
OLPopover.displayName = 'OLPopover'

export default OLPopover
