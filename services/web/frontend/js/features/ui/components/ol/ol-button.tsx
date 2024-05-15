import BootstrapVersionSwitcher from '../bootstrap-5/bootstrap-version-switcher'
import { Button as BS3Button } from 'react-bootstrap'
import type { ButtonProps } from '@/features/ui/components/types/button-props'
import type { ButtonProps as BS3ButtonPropsBase } from 'react-bootstrap'
import Button from '../bootstrap-5/button'

export type OLButtonProps = ButtonProps & {
  bs3Props?: {
    bsStyle?: string | null
    className?: string
    loading?: React.ReactNode
  }
}

// Resolve type mismatch of the onClick event handler
export type BS3ButtonProps = Omit<BS3ButtonPropsBase, 'onClick'> & {
  onClick?: React.MouseEventHandler<any>
}

// maps Bootstrap 5 sizes to Bootstrap 3 sizes
export const mapBsButtonSizes = (
  size: ButtonProps['size']
): 'sm' | 'lg' | undefined =>
  size === 'small' ? 'sm' : size === 'large' ? 'lg' : undefined

export default function OLButton(props: OLButtonProps) {
  const { bs3Props, ...rest } = props

  const bs3ButtonProps: BS3ButtonProps = {
    bsStyle: rest.variant === 'secondary' ? 'default' : rest.variant,
    bsSize: mapBsButtonSizes(rest.size),
    className: rest.className,
    disabled: rest.isLoading || rest.disabled,
    form: rest.form,
    href: rest.href,
    onClick: rest.onClick,
    type: rest.type,
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={
        <BS3Button {...bs3ButtonProps}>
          {bs3Props?.loading || rest.children}
        </BS3Button>
      }
      bs5={<Button {...rest} />}
    />
  )
}
