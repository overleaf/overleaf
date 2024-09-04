import { forwardRef, ComponentProps } from 'react'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'
import FormControl from '@/features/ui/components/bootstrap-5/form/form-control'
import BS3FormControl from '@/features/ui/components/bootstrap-3/form/form-control'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLFormControlProps = ComponentProps<typeof FormControl> & {
  bs3Props?: Record<string, unknown>
  'data-ol-dirty'?: unknown
}

type BS3FormControlProps = ComponentProps<typeof BS3FormControl>

const OLFormControl = forwardRef<HTMLInputElement, OLFormControlProps>(
  (props, ref) => {
    const { bs3Props, ...rest } = props

    let bs3FormControlProps: BS3FormControlProps = {
      componentClass: rest.as,
      id: rest.id,
      name: rest.name,
      className: rest.className,
      style: rest.style,
      type: rest.type,
      value: rest.value,
      defaultValue: rest.defaultValue,
      required: rest.required,
      disabled: rest.disabled,
      placeholder: rest.placeholder,
      readOnly: rest.readOnly,
      autoComplete: rest.autoComplete,
      autoFocus: rest.autoFocus,
      minLength: rest.minLength,
      maxLength: rest.maxLength,
      onChange: rest.onChange as BS3FormControlProps['onChange'],
      onKeyDown: rest.onKeyDown as BS3FormControlProps['onKeyDown'],
      onFocus: rest.onFocus as BS3FormControlProps['onFocus'],
      onBlur: rest.onBlur as BS3FormControlProps['onBlur'],
      onInvalid: rest.onInvalid as BS3FormControlProps['onInvalid'],
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
