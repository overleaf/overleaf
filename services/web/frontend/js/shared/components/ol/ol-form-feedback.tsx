import { Form } from 'react-bootstrap'
import { ComponentProps } from 'react'
import FormFeedback from '@/shared/components/form/form-feedback'

type OLFormFeedbackProps = Pick<
  ComponentProps<typeof Form.Control.Feedback>,
  'type' | 'className' | 'children'
>

function OLFormFeedback(props: OLFormFeedbackProps) {
  return <FormFeedback {...props} />
}

export default OLFormFeedback
