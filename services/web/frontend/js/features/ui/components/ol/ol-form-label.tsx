import { Form } from 'react-bootstrap-5'

function OLFormLabel(props: React.ComponentProps<(typeof Form)['Label']>) {
  return <Form.Label {...props} />
}

export default OLFormLabel
