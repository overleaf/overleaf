import { Form, FormCheckProps } from 'react-bootstrap'
import classNames from 'classnames'

type DSFormCheckboxProps = Pick<
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

function DSFormCheckbox(props: DSFormCheckboxProps) {
  const { className, ...rest } = props
  return (
    <Form.Check
      type="checkbox"
      className={classNames('form-check-ds', className)}
      {...rest}
    />
  )
}

export default DSFormCheckbox
