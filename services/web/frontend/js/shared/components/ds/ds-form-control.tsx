import { forwardRef } from 'react'
import { Form, FormControlProps } from 'react-bootstrap'
import classnames from 'classnames'

interface ButtonProps extends FormControlProps {
  size?: 'lg'
}

const DSFormControl = forwardRef<HTMLInputElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <Form.Control
        ref={ref}
        {...props}
        className={classnames('form-control-ds', className)}
      />
    )
  }
)
DSFormControl.displayName = 'DSFormControl'

export default DSFormControl
