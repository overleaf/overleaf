import { bs3ButtonProps, BS3ButtonSize } from './ol-button'
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

  const { fw, loading, ...bs3Rest } = bs3Props || {}

  return (
    <BootstrapVersionSwitcher
      bs3={
        <BS3Button {...bs3ButtonProps(rest)} {...bs3Rest}>
          {loading || (
            <Icon
              type={rest.icon}
              fw={fw}
              accessibilityLabel={rest.accessibilityLabel}
            />
          )}
        </BS3Button>
      }
      bs5={<IconButton {...rest} />}
    />
  )
}
