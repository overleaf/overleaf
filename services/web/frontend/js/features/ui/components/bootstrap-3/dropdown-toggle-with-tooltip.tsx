import { forwardRef } from 'react'
import Tooltip from '../../../../shared/components/tooltip'
import classnames from 'classnames'
import { DropdownProps } from 'react-bootstrap'
import { MergeAndOverride } from '../../../../../../types/utils'

type CustomToggleProps = MergeAndOverride<
  Pick<DropdownProps, 'bsClass' | 'open'>,
  {
    children: React.ReactNode
    isOpened: boolean
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
    isOpened,
    children,
    bsClass,
    className,
    open,
    bsRole: _bsRole,
    ...rest
  } = props

  const button = (
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
  )

  return (
    <>{isOpened ? button : <Tooltip {...tooltipProps}>{button}</Tooltip>}</>
  )
})

DropdownToggleWithTooltip.displayName = 'DropdownToggleWithTooltip'

export default DropdownToggleWithTooltip
