import { Form } from 'react-bootstrap-5'
import { MergeAndOverride } from '../../../../../../../types/utils'
import MaterialIcon from '@/shared/components/material-icon'
import classnames from 'classnames'

type FormTextProps = MergeAndOverride<
  React.ComponentProps<(typeof Form)['Text']>,
  | {
      isInfo?: boolean
      isError?: never
      isWarning?: never
      isSuccess?: never
    }
  | {
      isInfo?: never
      isError?: boolean
      isWarning?: never
      isSuccess?: never
    }
  | {
      isInfo?: never
      isError?: never
      isWarning?: boolean
      isSuccess?: never
    }
  | {
      isInfo?: never
      isError?: never
      isWarning?: never
      isSuccess?: boolean
    }
>

export const getFormTextColor = ({
  isError,
  isSuccess,
  isWarning,
}: {
  isError?: boolean
  isSuccess?: boolean
  isWarning?: boolean
}) => ({
  'text-danger': isError,
  'text-success': isSuccess,
  'text-warning': isWarning,
})

function FormText({
  isInfo,
  isError,
  isWarning,
  isSuccess,
  children,
  className,
  ...rest
}: FormTextProps) {
  return (
    <Form.Text
      className={classnames(
        className,
        getFormTextColor({ isError, isSuccess, isWarning })
      )}
      {...rest}
    >
      {isInfo && <MaterialIcon type="info" className="text-info" />}
      {isError && <MaterialIcon type="error" />}
      {isWarning && <MaterialIcon type="warning" />}
      {isSuccess && <MaterialIcon type="check_circle" />}
      {children}
    </Form.Text>
  )
}

export default FormText
