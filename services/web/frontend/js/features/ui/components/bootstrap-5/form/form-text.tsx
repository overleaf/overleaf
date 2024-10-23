import { Form, FormTextProps as BS5FormTextProps } from 'react-bootstrap-5'
import MaterialIcon from '@/shared/components/material-icon'
import classnames from 'classnames'
import { MergeAndOverride } from '../../../../../../../types/utils'

type TextType = 'default' | 'info' | 'success' | 'warning' | 'error'

export type FormTextProps = MergeAndOverride<
  BS5FormTextProps,
  {
    type?: TextType
  }
>

const typeClassMap: Partial<Record<TextType, string>> = {
  error: 'text-danger',
  success: 'text-success',
  warning: 'text-warning',
}

export const getFormTextClass = (type?: TextType) =>
  typeClassMap[type || 'default']

function FormTextIcon({ type }: { type?: TextType }) {
  switch (type) {
    case 'info':
      return <MaterialIcon type="info" className="text-info" />
    case 'success':
      return <MaterialIcon type="check_circle" />
    case 'warning':
      return <MaterialIcon type="warning" />
    case 'error':
      return <MaterialIcon type="error" />
    default:
      return null
  }
}

function FormText({
  type = 'default',
  children,
  className,
  ...rest
}: FormTextProps) {
  return (
    <Form.Text
      className={classnames(className, getFormTextClass(type))}
      {...rest}
    >
      <span className="form-text-inner">
        <FormTextIcon type={type} />
        {children}
      </span>
    </Form.Text>
  )
}

export default FormText
