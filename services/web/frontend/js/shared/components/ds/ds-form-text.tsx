import { Form, FormTextProps as BS5FormTextProps } from 'react-bootstrap'
import classnames from 'classnames'
import { MergeAndOverride } from '@ol-types/utils'
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'

type TextType = 'success' | 'error'

export type FormTextProps = MergeAndOverride<
  BS5FormTextProps,
  {
    type?: TextType
    marginless?: boolean
  }
>

const typeClasses = {
  error: 'text-danger',
  success: 'text-success',
} as const

export const getFormTextClass = (type?: TextType) =>
  type && type in typeClasses
    ? typeClasses[type as keyof typeof typeClasses]
    : undefined

function FormTextIcon({ type }: { type?: TextType }) {
  switch (type) {
    case 'success':
      return <CheckCircle className="ciam-form-text-icon" />
    case 'error':
      return <WarningCircle className="ciam-form-text-icon" />
    default:
      return null
  }
}

function DSFormText({
  type,
  marginless,
  children,
  className,
  ...rest
}: FormTextProps) {
  return (
    <Form.Text
      className={classnames('form-text-ds', className, getFormTextClass(type), {
        marginless,
      })}
      {...rest}
    >
      <span className="form-text-inner-ds">
        <FormTextIcon type={type} />
        <span>{children}</span>
      </span>
    </Form.Text>
  )
}

export default DSFormText
