import { forwardRef } from 'react'
import { Form, FormGroupProps } from 'react-bootstrap'
import classnames from 'classnames'

const DSFormGroup = forwardRef<typeof Form.Group, FormGroupProps>(
  ({ className, ...props }, ref) => {
    return (
      <Form.Group
        className={classnames('form-group-ds', className)}
        {...props}
        ref={ref}
      />
    )
  }
)
DSFormGroup.displayName = 'DSFormGroup'

export default DSFormGroup
