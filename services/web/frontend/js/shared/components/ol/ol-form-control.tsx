import { forwardRef } from 'react'
import FormControl, {
  type OLBS5FormControlProps,
} from '@/shared/components/form/form-control'
import OLSpinner from '@/shared/components/ol/ol-spinner'

type OLFormControlProps = OLBS5FormControlProps & {
  'data-ol-dirty'?: unknown
  'main-field'?: any // For the CM6's benefit in the editor search panel
  loading?: boolean
}

const OLFormControl = forwardRef<HTMLInputElement, OLFormControlProps>(
  (props, ref) => {
    const { append, ...rest } = props

    return (
      <FormControl
        ref={ref}
        {...rest}
        append={rest.loading ? <OLSpinner size="sm" /> : append}
      />
    )
  }
)
OLFormControl.displayName = 'OLFormControl'

export default OLFormControl
