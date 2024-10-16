import { forwardRef } from 'react'
import BootstrapVersionSwitcher from '../bootstrap-5/bootstrap-version-switcher'
import { Button as BS3Button } from 'react-bootstrap'
import type { ButtonProps } from '@/features/ui/components/types/button-props'
import type { ButtonProps as BS3ButtonPropsBase } from 'react-bootstrap'
import Button from '../bootstrap-5/button'
import classnames from 'classnames'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'
import { callFnsInSequence } from '@/utils/functions'
import Icon from '@/shared/components/icon'

export type BS3ButtonSize = 'xsmall' | 'sm' | 'medium' | 'lg'

export type OLButtonProps = ButtonProps & {
  bs3Props?: {
    loading?: React.ReactNode
    bsSize?: BS3ButtonSize
    block?: boolean
    className?: string
    onMouseOver?: React.MouseEventHandler<HTMLButtonElement>
    onMouseOut?: React.MouseEventHandler<HTMLButtonElement>
    onFocus?: React.FocusEventHandler<HTMLButtonElement>
    onBlur?: React.FocusEventHandler<HTMLButtonElement>
  }
}

// Resolve type mismatch of the onClick event handler
export type BS3ButtonProps = Omit<BS3ButtonPropsBase, 'onClick'> & {
  onClick?: React.MouseEventHandler<any>
}

export function bs3ButtonProps(props: ButtonProps) {
  const bs3ButtonProps: BS3ButtonProps = {
    bsStyle: null,
    bsSize: props.size,
    className: classnames(`btn-${props.variant || 'primary'}`, props.className),
    disabled: props.isLoading || props.disabled,
    form: props.form,
    href: props.href,
    id: props.id,
    target: props.target,
    rel: props.rel,
    onClick: props.onClick,
    onMouseDown: props.onMouseDown as BS3ButtonProps['onMouseDown'],
    type: props.type,
    draggable: props.draggable,
    download: props.download,
    style: props.style,
    active: props.active,
  }
  return bs3ButtonProps
}

function BS3ButtonContent({
  children,
  leadingIcon,
  trailingIcon,
}: {
  children: React.ReactNode
  leadingIcon: OLButtonProps['leadingIcon']
  trailingIcon: OLButtonProps['trailingIcon']
}) {
  const leadingIconComponent =
    leadingIcon && typeof leadingIcon === 'string' ? (
      <Icon type={leadingIcon} />
    ) : (
      leadingIcon
    )

  const trailingIconComponent =
    trailingIcon && typeof trailingIcon === 'string' ? (
      <Icon type={trailingIcon} />
    ) : (
      trailingIcon
    )

  return (
    <>
      {leadingIconComponent ? <>{leadingIconComponent}&nbsp;</> : null}
      {children}
      {trailingIconComponent ? <>&nbsp;{trailingIconComponent}</> : null}
    </>
  )
}

const OLButton = forwardRef<HTMLButtonElement, OLButtonProps>(
  ({ bs3Props = {}, ...rest }, ref) => {
    const { className: _, ...restBs3Props } = bs3Props

    // BS3 OverlayTrigger automatically provides 'onMouseOver', 'onMouseOut', 'onFocus', 'onBlur' event handlers
    const bs3FinalProps = {
      ...restBs3Props,
      onMouseOver: callFnsInSequence(bs3Props?.onMouseOver, rest.onMouseOver),
      onMouseOut: callFnsInSequence(bs3Props?.onMouseOut, rest.onMouseOut),
      onFocus: callFnsInSequence(bs3Props?.onFocus, rest.onFocus),
      onBlur: callFnsInSequence(bs3Props?.onBlur, rest.onBlur),
    }

    // Get all `aria-*` and `data-*` attributes
    const extraProps = getAriaAndDataProps(rest)

    return (
      <BootstrapVersionSwitcher
        bs3={
          <BS3Button
            {...bs3ButtonProps({
              ...rest,
              // Override the `className` with bs3 specific className (if provided)
              className: bs3Props?.className ?? rest.className,
            })}
            {...extraProps}
            {...bs3FinalProps}
            ref={ref as React.LegacyRef<any> | undefined}
          >
            {bs3Props?.loading || (
              <BS3ButtonContent
                leadingIcon={rest.leadingIcon}
                trailingIcon={rest.trailingIcon}
              >
                {rest.children}
              </BS3ButtonContent>
            )}
          </BS3Button>
        }
        bs5={<Button {...rest} ref={ref} />}
      />
    )
  }
)
OLButton.displayName = 'OLButton'

export default OLButton
