import { Form } from 'react-bootstrap'
import OLFormText from '@/shared/components/ol/ol-form-text'
import { ComponentProps } from 'react'

export type FormFeedbackProps = Pick<
  ComponentProps<typeof Form.Control.Feedback>,
  'type' | 'className' | 'children'
>

function DSFormFeedback(props: FormFeedbackProps) {
  return (
    <Form.Control.Feedback {...props}>
      <OLFormText type={props.type === 'invalid' ? 'error' : 'success'}>
        {props.children}
      </OLFormText>
    </Form.Control.Feedback>
  )
}

export default DSFormFeedback
