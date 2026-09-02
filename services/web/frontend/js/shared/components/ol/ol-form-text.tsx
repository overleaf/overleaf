import { Form, FormTextProps as FormTextProps } from 'react-bootstrap'
import MaterialIcon from '@/shared/components/material-icon'
import classnames from 'classnames'
import { MergeAndOverride } from '../../../../../types/utils'

type TextType = 'default' | 'info' | 'success' | 'warning' | 'error'

export type OLFormTextProps = MergeAndOverride<
  FormTextProps,
  {
    type?: TextType
    unfilled?: boolean
    marginless?: boolean
  }
>

const typeClassMap: Partial<Record<TextType, string>> = {
  error: 'text-danger',
  success: 'text-success',
  warning: 'text-warning',
}

export const getFormTextClass = (type?: TextType) =>
  typeClassMap[type || 'default']

function FormTextIcon({
  type,
  unfilled,
}: Pick<OLFormTextProps, 'type' | 'unfilled'>) {
  switch (type) {
    case 'info':
      return unfilled ? (
        <MaterialIcon type="info" className="text-info" unfilled />
      ) : (
        <MaterialIcon type="info" className="text-info" />
      )
    case 'success':
      return unfilled ? (
        <MaterialIcon type="check_circle" unfilled />
      ) : (
        <MaterialIcon type="check_circle" />
      )
    case 'warning':
      return unfilled ? (
        <MaterialIcon type="warning" unfilled />
      ) : (
        <MaterialIcon type="warning" />
      )
    case 'error':
      return unfilled ? (
        <MaterialIcon type="error" unfilled />
      ) : (
        <MaterialIcon type="error" />
      )
    default:
      return null
  }
}

// Base component without a default `as` — exported for use by the backward-compat shim
export function FormText({
  type = 'default',
  marginless,
  children,
  className,
  unfilled,
  ...rest
}: OLFormTextProps) {
  return (
    <Form.Text
      className={classnames(className, getFormTextClass(type), { marginless })}
      {...rest}
    >
      <span className="form-text-inner">
        <FormTextIcon type={type} unfilled={unfilled} />
        <span>{children}</span>
      </span>
    </Form.Text>
  )
}

// OL component defaults to rendering as a <div>
function OLFormText({ as = 'div', ...rest }: OLFormTextProps) {
  return <FormText as={as} {...rest} />
}

export default OLFormText
