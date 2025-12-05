import { Form, FormCheckProps } from 'react-bootstrap'
import classNames from 'classnames'

type DSFormRadioProps = Pick<
  FormCheckProps,
  | 'disabled'
  | 'checked'
  | 'onChange'
  | 'label'
  | 'name'
  | 'value'
  | 'id'
  | 'className'
>

function DSFormRadio(props: DSFormRadioProps) {
  const { className, ...rest } = props
  return (
    <Form.Check
      type="radio"
      className={classNames('form-check-ds', className)}
      {...rest}
    />
  )
}

export default DSFormRadio
