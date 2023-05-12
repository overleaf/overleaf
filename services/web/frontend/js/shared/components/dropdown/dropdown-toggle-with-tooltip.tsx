import { forwardRef } from 'react'
import Tooltip from '../tooltip'
import classnames from 'classnames'
import { DropdownProps } from 'react-bootstrap'
import { MergeAndOverride } from '../../../../../types/utils'

type CustomToggleProps = MergeAndOverride<
  Pick<DropdownProps, 'bsClass' | 'open'>,
  {
    children: React.ReactNode
    bsRole: 'toggle'
    className?: string
    tooltipProps: Omit<React.ComponentProps<typeof Tooltip>, 'children'>
  }
>

const DropdownToggleWithTooltip = forwardRef<
  HTMLButtonElement,
  CustomToggleProps
>(function (props, ref) {
  const {
    tooltipProps,
    children,
    bsClass,
    className,
    open,
    bsRole: _bsRole,
    ...rest
  } = props

  return (
    <Tooltip {...tooltipProps}>
      <button
        type="button"
        ref={ref}
        className={classnames(bsClass, 'btn', className)}
        aria-expanded={open}
        aria-haspopup="true"
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  )
})
DropdownToggleWithTooltip.displayName = 'DropdownToggleWithTooltip'

export default DropdownToggleWithTooltip
