import { forwardRef } from 'react'
import { Form } from 'react-bootstrap-5'
import { FormControl as BS3FormControl } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

type OLFormControlProps = React.ComponentProps<(typeof Form)['Control']> & {
  bs3Props?: Record<string, unknown>
}

const OLFormControl = forwardRef<HTMLInputElement, OLFormControlProps>(
  (props, ref) => {
    const { bs3Props, ...rest } = props

    let bs3FormControlProps: React.ComponentProps<typeof BS3FormControl> = {
      id: rest.id,
      className: rest.className,
      style: rest.style,
      type: rest.type,
      value: rest.value,
      required: rest.required,
      disabled: rest.disabled,
      placeholder: rest.placeholder,
      readOnly: rest.readOnly,
      autoComplete: rest.autoComplete,
      autoFocus: rest.autoFocus,
      minLength: rest.minLength,
      maxLength: rest.maxLength,
      onChange: rest.onChange as (e: React.ChangeEvent<unknown>) => void,
      onKeyDown: rest.onKeyDown as (e: React.KeyboardEvent<unknown>) => void,
      onFocus: rest.onFocus as (e: React.FocusEvent<unknown>) => void,
      onInvalid: rest.onInvalid as (e: React.InvalidEvent<unknown>) => void,
      inputRef: (inputElement: HTMLInputElement) => {
        if (typeof ref === 'function') {
          ref(inputElement)
        } else if (ref) {
          ref.current = inputElement
        }
      },
      ...bs3Props,
    }

    bs3FormControlProps = {
      ...bs3FormControlProps,
      ...getAriaAndDataProps(rest),
      'data-ol-dirty': rest['data-ol-dirty'],
    } as typeof bs3FormControlProps & Record<string, unknown>

    return (
      <BootstrapVersionSwitcher
        bs3={<BS3FormControl {...bs3FormControlProps} />}
        bs5={<Form.Control ref={ref} {...rest} />}
      />
    )
  }
)
OLFormControl.displayName = 'OLFormControl'

export default OLFormControl
