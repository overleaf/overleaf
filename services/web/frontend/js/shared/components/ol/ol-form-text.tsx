import FormText, { FormTextProps } from '@/shared/components/form/form-text'

function OLFormText({ as = 'div', ...rest }: FormTextProps) {
  return <FormText {...rest} as={as} />
}

export default OLFormText
