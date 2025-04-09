import { forwardRef } from 'react'
import type { ButtonProps } from '@/features/ui/components/types/button-props'
import Button from '../bootstrap-5/button'

export type OLButtonProps = ButtonProps

const OLButton = forwardRef<HTMLButtonElement, OLButtonProps>((props, ref) => {
  return <Button {...props} ref={ref} />
})

OLButton.displayName = 'OLButton'

export default OLButton
