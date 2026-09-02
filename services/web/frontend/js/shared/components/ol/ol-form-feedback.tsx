import { Form } from 'react-bootstrap'
import { FormText } from './ol-form-text'
import { ComponentProps } from 'react'

export type OLFormFeedbackProps = Pick<
  ComponentProps<typeof Form.Control.Feedback>,
  'type' | 'className' | 'children'
> & { unfilled?: boolean }

function OLFormFeedback({ unfilled, ...props }: OLFormFeedbackProps) {
  return (
    <Form.Control.Feedback {...props}>
      <FormText
        type={props.type === 'invalid' ? 'error' : 'success'}
        unfilled={unfilled}
      >
        {props.children}
      </FormText>
    </Form.Control.Feedback>
  )
}

export default OLFormFeedback
