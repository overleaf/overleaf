import { Form, FormCheckProps } from 'react-bootstrap'
import { MergeAndOverride } from '../../../../../types/utils'
import FormText from '../form/form-text'

type OLFormCheckboxProps = MergeAndOverride<
  FormCheckProps,
  {
    inputRef?: React.MutableRefObject<HTMLInputElement | null>
  } & (
    | { description: string; id: string }
    | { description?: undefined; id?: string }
  )
>

function OLFormCheckbox(props: OLFormCheckboxProps) {
  const { inputRef, ...rest } = props

  return rest.type === 'radio' ? (
    <Form.Check
      ref={inputRef}
      aria-describedby={rest.description ? `${rest.id}-description` : undefined}
      {...rest}
      label={
        <>
          {rest.label}
          {rest.description && (
            <FormText
              id={`${rest.id}-description`}
              className="form-check-label-description"
            >
              {rest.description}
            </FormText>
          )}
        </>
      }
    />
  ) : (
    <Form.Check ref={inputRef} {...rest} />
  )
}

export default OLFormCheckbox
