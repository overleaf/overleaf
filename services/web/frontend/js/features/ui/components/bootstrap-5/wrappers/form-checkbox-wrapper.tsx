import { Form } from 'react-bootstrap-5'
import { Checkbox as BS3Checkbox } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type FormCheckboxWrapperProps = React.ComponentProps<(typeof Form)['Check']> & {
  bs3Props?: Record<string, unknown>
}

function FormCheckboxWrapper(props: FormCheckboxWrapperProps) {
  const { bs3Props, ...rest } = props

  const bs3FormLabelProps: React.ComponentProps<typeof BS3Checkbox> = {
    children: rest.label,
    checked: rest.checked,
    required: rest.required,
    readOnly: rest.readOnly,
    disabled: rest.disabled,
    inline: rest.inline,
    title: rest.title,
    onChange: rest.onChange as (e: React.ChangeEvent<unknown>) => void,
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Checkbox {...bs3FormLabelProps} />}
      bs5={<Form.Check {...rest} />}
    />
  )
}

export default FormCheckboxWrapper
