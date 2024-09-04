import BootstrapVersionSwitcher from '../bootstrap-5/bootstrap-version-switcher'
import { Button as BS3Button } from 'react-bootstrap'
import type { ButtonProps } from '@/features/ui/components/types/button-props'
import type { ButtonProps as BS3ButtonPropsBase } from 'react-bootstrap'
import Button from '../bootstrap-5/button'
import classnames from 'classnames'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

export type BS3ButtonSize = 'xsmall' | 'sm' | 'medium' | 'lg'

export type OLButtonProps = ButtonProps & {
  bs3Props?: {
    loading?: React.ReactNode
    bsSize?: BS3ButtonSize
    block?: boolean
  }
}

// Resolve type mismatch of the onClick event handler
export type BS3ButtonProps = Omit<BS3ButtonPropsBase, 'onClick'> & {
  onClick?: React.MouseEventHandler<any>
}

export function bs3ButtonProps(props: ButtonProps) {
  const bs3ButtonProps: BS3ButtonProps = {
    bsStyle: null,
    bsSize: mapBsButtonSizes(props.size),
    className: classnames(`btn-${props.variant || 'primary'}`, props.className),
    disabled: props.isLoading || props.disabled,
    form: props.form,
    href: props.href,
    target: props.target,
    rel: props.rel,
    onClick: props.onClick,
    type: props.type,
  }
  return bs3ButtonProps
}

// maps Bootstrap 5 sizes to Bootstrap 3 sizes
export const mapBsButtonSizes = (
  size: ButtonProps['size']
): 'sm' | 'lg' | undefined =>
  size === 'small' ? 'sm' : size === 'large' ? 'lg' : undefined

export default function OLButton(props: OLButtonProps) {
  const { bs3Props, ...rest } = props

  // Get all `aria-*` and `data-*` attributes
  const extraProps = getAriaAndDataProps(rest)

  return (
    <BootstrapVersionSwitcher
      bs3={
        <BS3Button {...bs3ButtonProps(rest)} {...bs3Props} {...extraProps}>
          {bs3Props?.loading || rest.children}
        </BS3Button>
      }
      bs5={<Button {...rest} />}
    />
  )
}
