import { forwardRef, ComponentProps, useCallback } from 'react'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'
import FormControl, {
  type OLBS5FormControlProps,
} from '@/features/ui/components/bootstrap-5/form/form-control'
import BS3FormControl from '@/features/ui/components/bootstrap-3/form/form-control'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import OLSpinner from '@/features/ui/components/ol/ol-spinner'
import Icon from '@/shared/components/icon'
import type { BsPrefixRefForwardingComponent } from 'react-bootstrap-5/helpers'

type OLFormControlProps = OLBS5FormControlProps & {
  bs3Props?: Record<string, unknown>
  'data-ol-dirty'?: unknown
  'main-field'?: any // For the CM6's benefit in the editor search panel
  loading?: boolean
}

type BS3FormControlProps = ComponentProps<typeof BS3FormControl> & {
  'main-field'?: any
}

const OLFormControl: BsPrefixRefForwardingComponent<
  'input',
  OLFormControlProps
> = forwardRef<HTMLInputElement, OLFormControlProps>((props, ref) => {
  const { bs3Props, append, ...rest } = props

  // Use a callback so that the ref passed to the BS3 FormControl is stable
  const bs3InputRef = useCallback(
    (inputElement: HTMLInputElement) => {
      if (typeof ref === 'function') {
        ref(inputElement)
      } else if (ref) {
        ref.current = inputElement
      }
    },
    [ref]
  )

  let bs3FormControlProps: BS3FormControlProps = {
    inputRef: bs3InputRef,
    componentClass: rest.as,
    bsSize: rest.size,
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
    prepend: rest.prepend,
    size: rest.htmlSize,
    'main-field': rest['main-field'],
    children: rest.children,
    ...bs3Props,
  }

  bs3FormControlProps = {
    ...bs3FormControlProps,
    ...getAriaAndDataProps(rest),
    'data-ol-dirty': rest['data-ol-dirty'],
  } as typeof bs3FormControlProps & Record<string, unknown>

  return (
    <BootstrapVersionSwitcher
      bs3={
        <BS3FormControl
          {...bs3FormControlProps}
          append={rest.loading ? <Icon type="spinner" spin /> : append}
        />
      }
      bs5={
        <FormControl
          ref={ref}
          {...rest}
          append={rest.loading ? <OLSpinner size="sm" /> : append}
        />
      }
    />
  )
})
OLFormControl.displayName = 'OLFormControl'

export default OLFormControl
