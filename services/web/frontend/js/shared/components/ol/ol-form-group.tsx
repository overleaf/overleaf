import { FormGroup, FormGroupProps } from 'react-bootstrap'
import classnames from 'classnames'

function OLFormGroup({ className, ...props }: FormGroupProps) {
  return (
    <FormGroup className={classnames('form-group', className)} {...props} />
  )
}

export default OLFormGroup
