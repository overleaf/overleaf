import { forwardRef } from 'react'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'
import BS3FormControl from '@/features/ui/components/bootstrap-3/form/form-control'
import FormControl from '@/features/ui/components/bootstrap-5/form/form-control'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLFormControlProps = React.ComponentProps<typeof FormControl> & {
  bs3Props?: Record<string, unknown>
  'data-ol-dirty'?: unknown
}

const OLFormControl = forwardRef<HTMLInputElement, OLFormControlProps>(
  (props, ref) => {
    const { bs3Props, ...rest } = props

    let bs3FormControlProps: React.ComponentProps<typeof BS3FormControl> = {
      id: rest.id,
      name: rest.name,
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
      prepend: rest.prepend,
      append: rest.append,
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
        bs5={<FormControl ref={ref} {...rest} />}
      />
    )
  }
)
OLFormControl.displayName = 'OLFormControl'

export default OLFormControl
