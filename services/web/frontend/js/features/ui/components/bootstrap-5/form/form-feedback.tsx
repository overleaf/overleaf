import { Form } from 'react-bootstrap-5'
import FormText from '@/features/ui/components/bootstrap-5/form/form-text'
import { ComponentProps } from 'react'

export type FormFeedbackProps = Pick<
  ComponentProps<typeof Form.Control.Feedback>,
  'type' | 'className' | 'children'
>

function FormFeedback(props: FormFeedbackProps) {
  return (
    <Form.Control.Feedback {...props}>
      <FormText type={props.type === 'invalid' ? 'error' : 'success'}>
        {props.children}
      </FormText>
    </Form.Control.Feedback>
  )
}

export default FormFeedback
