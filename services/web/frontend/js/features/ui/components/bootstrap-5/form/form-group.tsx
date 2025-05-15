import { forwardRef } from 'react'
import { FormGroup as BS5FormGroup, FormGroupProps } from 'react-bootstrap'
import classnames from 'classnames'

const FormGroup = forwardRef<typeof BS5FormGroup, FormGroupProps>(
  ({ className, ...props }, ref) => {
    const classNames = classnames('form-group', className)

    return <BS5FormGroup className={classNames} {...props} ref={ref} />
  }
)
FormGroup.displayName = 'FormGroup'

export default FormGroup
