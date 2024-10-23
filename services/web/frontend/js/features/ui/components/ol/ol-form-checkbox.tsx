import { Form } from 'react-bootstrap-5'
import { Checkbox as BS3Checkbox, Radio as BS3Radio } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

type OLFormCheckboxProps = React.ComponentProps<(typeof Form)['Check']> & {
  inputRef?: React.MutableRefObject<HTMLInputElement | null>
  bs3Props?: Record<string, unknown>
}

function OLFormCheckbox(props: OLFormCheckboxProps) {
  const { bs3Props, inputRef, ...rest } = props

  const bs3FormCheckboxProps: React.ComponentProps<typeof BS3Checkbox> = {
    children: rest.label,
    checked: rest.checked,
    value: rest.value,
    name: rest.name,
    required: rest.required,
    readOnly: rest.readOnly,
    disabled: rest.disabled,
    inline: rest.inline,
    title: rest.title,
    autoComplete: rest.autoComplete,
    defaultChecked: rest.defaultChecked,
    className: rest.className,
    onChange: rest.onChange as (e: React.ChangeEvent<unknown>) => void,
    inputRef: node => {
      if (inputRef) {
        inputRef.current = node
      }
    },
    ...getAriaAndDataProps(rest),
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={
        rest.type === 'radio' ? (
          <BS3Radio {...bs3FormCheckboxProps} />
        ) : (
          <BS3Checkbox {...bs3FormCheckboxProps} />
        )
      }
      bs5={<Form.Check ref={inputRef} {...rest} />}
    />
  )
}

export default OLFormCheckbox
