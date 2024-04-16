import { BS3ButtonProps, mapBsButtonSizes } from './button-wrapper'
import { Button as BS3Button } from 'react-bootstrap'
import type { IconButtonProps } from '@/features/ui/components/types/icon-button-props'
import BootstrapVersionSwitcher from '../bootstrap-version-switcher'
import Icon, { IconProps } from '@/shared/components/icon'
import IconButton from '../icon-button'

export type IconButtonWrapperProps = IconButtonProps & {
  bs3Props?: {
    loading?: React.ReactNode
    fw?: IconProps['fw']
  }
}

export default function IconButtonWrapper(props: IconButtonWrapperProps) {
  const { bs3Props, ...rest } = props

  const { fw, ...filterBs3Props } = bs3Props || {}

  const bs3ButtonProps: BS3ButtonProps = {
    bsStyle: rest.variant,
    bsSize: mapBsButtonSizes(rest.size),
    disabled: rest.isLoading || rest.disabled,
    form: rest.form,
    onClick: rest.onClick,
    type: rest.type,
    ...filterBs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={
        <BS3Button {...bs3ButtonProps}>
          {bs3Props?.loading}
          <Icon
            type={rest.icon}
            fw={fw}
            accessibilityLabel={rest.accessibilityLabel}
          />
        </BS3Button>
      }
      bs5={<IconButton {...rest} />}
    />
  )
}
