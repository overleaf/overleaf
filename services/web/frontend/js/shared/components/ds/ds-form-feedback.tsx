import { Form } from 'react-bootstrap'
import FormText from '@/shared/components/form/form-text'
import { ComponentProps } from 'react'

export type FormFeedbackProps = Pick<
  ComponentProps<typeof Form.Control.Feedback>,
  'type' | 'className' | 'children'
>

function DSFormFeedback(props: FormFeedbackProps) {
  return (
    <Form.Control.Feedback {...props}>
      <FormText type={props.type === 'invalid' ? 'error' : 'success'}>
        {props.children}
      </FormText>
    </Form.Control.Feedback>
  )
}

export default DSFormFeedback
