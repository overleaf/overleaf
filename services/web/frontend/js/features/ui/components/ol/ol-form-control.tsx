import { forwardRef } from 'react'
import FormControl, {
  type OLBS5FormControlProps,
} from '@/features/ui/components/bootstrap-5/form/form-control'
import OLSpinner from '@/features/ui/components/ol/ol-spinner'
import type { BsPrefixRefForwardingComponent } from 'react-bootstrap-5/helpers'

type OLFormControlProps = OLBS5FormControlProps & {
  'data-ol-dirty'?: unknown
  'main-field'?: any // For the CM6's benefit in the editor search panel
  loading?: boolean
}

const OLFormControl: BsPrefixRefForwardingComponent<
  'input',
  OLFormControlProps
> = forwardRef<HTMLInputElement, OLFormControlProps>((props, ref) => {
  const { append, ...rest } = props

  return (
    <FormControl
      ref={ref}
      {...rest}
      append={rest.loading ? <OLSpinner size="sm" /> : append}
    />
  )
})
OLFormControl.displayName = 'OLFormControl'

export default OLFormControl
