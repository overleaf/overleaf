import { forwardRef, ReactNode } from 'react'
import { Button, ButtonProps } from 'react-bootstrap'

type DSButtonProps = Pick<
  ButtonProps,
  | 'children'
  | 'disabled'
  | 'href'
  | 'id'
  | 'target'
  | 'rel'
  | 'onClick'
  | 'onMouseDown'
  | 'onMouseOver'
  | 'onMouseOut'
  | 'onFocus'
  | 'onBlur'
  | 'size'
  | 'active'
  | 'type'
> & {
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger'
}

const DSButton = forwardRef<HTMLButtonElement, DSButtonProps>(
  (
    {
      children,
      leadingIcon,
      trailingIcon,
      variant = 'primary',
      size,
      ...props
    },
    ref
  ) => {
    return (
      <Button
        className="d-inline-grid btn-ds"
        variant={variant}
        size={size}
        {...props}
        ref={ref}
        role={undefined}
      >
        <span className="button-content">
          {leadingIcon}
          {children}
          {trailingIcon}
        </span>
      </Button>
    )
  }
)

DSButton.displayName = 'DSButton'

export default DSButton
