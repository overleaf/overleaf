import { FormCheck, FormCheckProps, FormLabel } from 'react-bootstrap-5'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

type OLFormSwitchProps = FormCheckProps & {
  inputRef?: React.MutableRefObject<HTMLInputElement | null>
  bs3Props?: React.InputHTMLAttributes<HTMLInputElement>
}

function OLFormSwitch(props: OLFormSwitchProps) {
  const { bs3Props, inputRef, label, id, ...rest } = props

  const bs3FormSwitchProps: React.InputHTMLAttributes<HTMLInputElement> = {
    id,
    checked: rest.checked,
    required: rest.required,
    readOnly: rest.readOnly,
    disabled: rest.disabled,
    autoComplete: rest.autoComplete,
    defaultChecked: rest.defaultChecked,
    onChange: rest.onChange as (e: React.ChangeEvent<unknown>) => void,
    ...getAriaAndDataProps(rest),
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={
        <div className="input-switch">
          <input
            id={id}
            type="checkbox"
            className="input-switch-hidden-input"
            ref={inputRef}
            {...bs3FormSwitchProps}
          />
          <label htmlFor={id} className="input-switch-btn">
            <span className="sr-only">{label}</span>
          </label>
        </div>
      }
      bs5={
        <>
          <FormCheck type="switch" ref={inputRef} id={id} {...rest} />
          <FormLabel htmlFor={id} visuallyHidden>
            {label}
          </FormLabel>
        </>
      }
    />
  )
}

export default OLFormSwitch
