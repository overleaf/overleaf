import FormText, {
  FormTextProps,
} from '@/features/ui/components/bootstrap-5/form/form-text'

function OLFormText({ as = 'div', ...rest }: FormTextProps) {
  return <FormText {...rest} as={as} />
}

export default OLFormText
