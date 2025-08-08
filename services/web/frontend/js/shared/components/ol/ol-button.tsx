import { forwardRef } from 'react'
import type { ButtonProps } from '@/shared/components/types/button-props'
import Button from '../button/button'

export type OLButtonProps = ButtonProps

const OLButton = forwardRef<HTMLButtonElement, OLButtonProps>((props, ref) => {
  return <Button {...props} ref={ref} />
})

OLButton.displayName = 'OLButton'

export default OLButton
