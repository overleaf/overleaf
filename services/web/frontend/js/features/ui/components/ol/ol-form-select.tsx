import { forwardRef } from 'react'
import { Form, FormSelectProps } from 'react-bootstrap-5'

const OLFormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  (props, ref) => {
    return <Form.Select ref={ref} {...props} />
  }
)
OLFormSelect.displayName = 'OLFormSelect'

export default OLFormSelect
