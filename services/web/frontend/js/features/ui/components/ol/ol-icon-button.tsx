import { BS3ButtonProps, BS3ButtonSize, mapBsButtonSizes } from './ol-button'
import { Button as BS3Button } from 'react-bootstrap'
import type { IconButtonProps } from '@/features/ui/components/types/icon-button-props'
import BootstrapVersionSwitcher from '../bootstrap-5/bootstrap-version-switcher'
import Icon, { IconProps } from '@/shared/components/icon'
import IconButton from '../bootstrap-5/icon-button'

export type OLIconButtonProps = IconButtonProps & {
  bs3Props?: {
    loading?: React.ReactNode
    fw?: IconProps['fw']
    className?: string
    bsSize?: BS3ButtonSize
  }
}

export default function OLIconButton(props: OLIconButtonProps) {
  const { bs3Props, ...rest } = props

  const { fw, ...filterBs3Props } = bs3Props || {}

  const bs3ButtonProps: BS3ButtonProps = {
    bsStyle: rest.variant === 'secondary' ? 'default' : rest.variant,
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
