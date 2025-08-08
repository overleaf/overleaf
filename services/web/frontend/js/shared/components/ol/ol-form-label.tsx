import { Form } from 'react-bootstrap'

function OLFormLabel(props: React.ComponentProps<(typeof Form)['Label']>) {
  return <Form.Label {...props} />
}

export default OLFormLabel
