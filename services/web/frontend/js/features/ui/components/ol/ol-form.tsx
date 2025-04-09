import { Form } from 'react-bootstrap-5'
import { ComponentProps } from 'react'

function OLForm(props: ComponentProps<typeof Form>) {
  return <Form {...props} />
}

export default OLForm
