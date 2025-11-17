import { ComponentProps } from 'react'
import { Form } from 'react-bootstrap'
import classnames from 'classnames'

function DSFormLabel({
  className,
  ...props
}: ComponentProps<typeof Form.Label>) {
  return (
    <Form.Label {...props} className={classnames('form-label-ds', className)} />
  )
}

export default DSFormLabel
