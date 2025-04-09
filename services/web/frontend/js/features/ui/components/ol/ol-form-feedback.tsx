import { Form } from 'react-bootstrap-5'
import { ComponentProps } from 'react'
import FormFeedback from '@/features/ui/components/bootstrap-5/form/form-feedback'

type OLFormFeedbackProps = Pick<
  ComponentProps<typeof Form.Control.Feedback>,
  'type' | 'className' | 'children'
>

function OLFormFeedback(props: OLFormFeedbackProps) {
  return <FormFeedback {...props} />
}

export default OLFormFeedback
