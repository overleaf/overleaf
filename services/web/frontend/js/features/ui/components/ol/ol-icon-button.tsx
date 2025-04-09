import { forwardRef } from 'react'
import type { IconButtonProps } from '@/features/ui/components/types/icon-button-props'
import IconButton from '../bootstrap-5/icon-button'

export type OLIconButtonProps = IconButtonProps

const OLIconButton = forwardRef<HTMLButtonElement, OLIconButtonProps>(
  (props, ref) => {
    // BS5 tooltip relies on the ref
    return <IconButton {...props} ref={ref} />
  }
)
OLIconButton.displayName = 'OLIconButton'

export default OLIconButton
