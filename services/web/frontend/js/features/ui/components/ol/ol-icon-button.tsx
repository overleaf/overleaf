import { forwardRef } from 'react'
import { bs3ButtonProps, BS3ButtonSize } from './ol-button'
import { Button as BS3Button } from 'react-bootstrap'
import type { IconButtonProps } from '@/features/ui/components/types/icon-button-props'
import BootstrapVersionSwitcher from '../bootstrap-5/bootstrap-version-switcher'
import Icon, { IconProps } from '@/shared/components/icon'
import IconButton from '../bootstrap-5/icon-button'
import { callFnsInSequence } from '@/utils/functions'

export type OLIconButtonProps = IconButtonProps & {
  bs3Props?: {
    loading?: React.ReactNode
    fw?: IconProps['fw']
    className?: string
    bsSize?: BS3ButtonSize
    onMouseOver?: React.MouseEventHandler<HTMLButtonElement>
    onMouseOut?: React.MouseEventHandler<HTMLButtonElement>
    onFocus?: React.FocusEventHandler<HTMLButtonElement>
    onBlur?: React.FocusEventHandler<HTMLButtonElement>
  }
}

const OLIconButton = forwardRef<HTMLButtonElement, OLIconButtonProps>(
  (props, ref) => {
    const { bs3Props, ...rest } = props

    const { fw, loading, ...bs3Rest } = bs3Props || {}

    // BS3 OverlayTrigger automatically provides 'onMouseOver', 'onMouseOut', 'onFocus', 'onBlur' event handlers
    const bs3FinalProps = {
      'aria-label': rest.accessibilityLabel,
      ...bs3ButtonProps(rest),
      ...bs3Rest,
      onMouseOver: callFnsInSequence(bs3Props?.onMouseOver, rest.onMouseOver),
      onMouseOut: callFnsInSequence(bs3Props?.onMouseOut, rest.onMouseOut),
      onFocus: callFnsInSequence(bs3Props?.onFocus, rest.onFocus),
      onBlur: callFnsInSequence(bs3Props?.onBlur, rest.onBlur),
    }

    // BS3 tooltip relies on the 'onMouseOver', 'onMouseOut', 'onFocus', 'onBlur' props
    // BS5 tooltip relies on the ref
    return (
      <BootstrapVersionSwitcher
        bs3={
          <BS3Button {...bs3FinalProps}>
            {loading || <Icon type={rest.icon} fw={fw} />}
          </BS3Button>
        }
        bs5={<IconButton {...rest} ref={ref} />}
      />
    )
  }
)
OLIconButton.displayName = 'OLIconButton'

export default OLIconButton
