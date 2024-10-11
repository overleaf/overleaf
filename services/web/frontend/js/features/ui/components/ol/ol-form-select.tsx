import { forwardRef } from 'react'
import { Form, FormSelectProps } from 'react-bootstrap-5'
import {
  FormControl as BS3FormControl,
  FormControlProps as BS3FormControlProps,
} from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

type OLFormSelectProps = FormSelectProps & {
  bs3Props?: Record<string, unknown>
}

const OLFormSelect = forwardRef<HTMLSelectElement, OLFormSelectProps>(
  (props, ref) => {
    const { bs3Props, ...bs5Props } = props

    const bs3FormSelectProps: BS3FormControlProps = {
      children: bs5Props.children,
      bsSize: bs5Props.size,
      name: bs5Props.name,
      value: bs5Props.value,
      defaultValue: bs5Props.defaultValue,
      disabled: bs5Props.disabled,
      onChange: bs5Props.onChange as BS3FormControlProps['onChange'],
      required: bs5Props.required,
      placeholder: bs5Props.placeholder,
      className: bs5Props.className,
      inputRef: (inputElement: HTMLInputElement) => {
        if (typeof ref === 'function') {
          ref(inputElement as unknown as HTMLSelectElement)
        } else if (ref) {
          ref.current = inputElement as unknown as HTMLSelectElement
        }
      },
      ...bs3Props,
    }

    // Get all `aria-*` and `data-*` attributes
    const extraProps = getAriaAndDataProps(bs5Props)

    return (
      <BootstrapVersionSwitcher
        bs3={
          <BS3FormControl
            componentClass="select"
            {...bs3FormSelectProps}
            {...extraProps}
          />
        }
        bs5={<Form.Select ref={ref} {...bs5Props} />}
      />
    )
  }
)
OLFormSelect.displayName = 'OLFormSelect'

export default OLFormSelect
