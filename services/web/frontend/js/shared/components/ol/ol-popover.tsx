import { forwardRef } from 'react'
import { Popover, PopoverProps } from 'react-bootstrap'

type OLPopoverProps = Omit<PopoverProps, 'title'> & {
  title?: React.ReactNode
}

const OLPopover = forwardRef<HTMLDivElement, OLPopoverProps>((props, ref) => {
  const { title, children, ...bs5Props } = props

  return (
    <Popover {...bs5Props} ref={ref}>
      {title && <Popover.Header>{title}</Popover.Header>}
      <Popover.Body>{children}</Popover.Body>
    </Popover>
  )
})
OLPopover.displayName = 'OLPopover'

export default OLPopover
