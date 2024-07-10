import { Form } from 'react-bootstrap-5'
import { Checkbox as BS3Checkbox, Radio as BS3Radio } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

type OLFormCheckboxProps = React.ComponentProps<(typeof Form)['Check']> & {
  inputRef?: React.MutableRefObject<HTMLInputElement | undefined>
  bs3Props?: Record<string, unknown>
}

function OLFormCheckbox(props: OLFormCheckboxProps) {
  const { bs3Props, inputRef, ...rest } = props

  const bs3FormLabelProps: React.ComponentProps<typeof BS3Checkbox> = {
    children: rest.label,
    checked: rest.checked,
    required: rest.required,
    readOnly: rest.readOnly,
    disabled: rest.disabled,
    inline: rest.inline,
    title: rest.title,
    autoComplete: rest.autoComplete,
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
          <BS3Radio {...bs3FormLabelProps} />
        ) : (
          <BS3Checkbox {...bs3FormLabelProps} />
        )
      }
      bs5={<Form.Check ref={inputRef} {...rest} />}
    />
  )
}

export default OLFormCheckbox
