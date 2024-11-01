import { Form, FormCheckProps } from 'react-bootstrap-5'
import { Checkbox as BS3Checkbox } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'
import { MergeAndOverride } from '../../../../../../types/utils'
import FormText from '../bootstrap-5/form/form-text'

type OLFormCheckboxProps = MergeAndOverride<
  FormCheckProps,
  {
    inputRef?: React.MutableRefObject<HTMLInputElement | null>
    bs3Props?: Record<PropertyKey, unknown>
  } & (
    | { description: string; id: string }
    | { description?: undefined; id?: string }
  )
>

type RadioButtonProps = {
  checked?: boolean
  className?: string
  description?: string
  disabled?: boolean
  id: string
  name?: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
  label: React.ReactElement | string
  value: string
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
          <BS3Radio {...(rest as RadioButtonProps)} />
        ) : (
          <BS3Checkbox {...bs3FormCheckboxProps} />
        )
      }
      bs5={
        rest.type === 'radio' ? (
          <Form.Check
            ref={inputRef}
            aria-describedby={
              rest.description ? `${rest.id}-description` : undefined
            }
            {...rest}
            label={
              <>
                {rest.label}
                {rest.description && (
                  <FormText
                    id={`${rest.id}-description`}
                    className="form-check-label-description"
                  >
                    {rest.description}
                  </FormText>
                )}
              </>
            }
          />
        ) : (
          <Form.Check ref={inputRef} {...rest} />
        )
      }
    />
  )
}

function BS3Radio(props: RadioButtonProps) {
  const {
    label,
    checked,
    className,
    description,
    disabled,
    id,
    name,
    onChange,
    required,
    value,
  } = props
  return (
    <div className={className}>
      <input
        checked={checked}
        className="me-1"
        disabled={disabled}
        id={id}
        name={name}
        onChange={onChange}
        type="radio"
        required={required}
        value={value}
        aria-describedby={description ? `${id}-description` : undefined}
      />
      <label htmlFor={id} data-disabled={disabled ? 'true' : undefined}>
        {label}
      </label>{' '}
      {description && (
        <small id={`${id}-description`} aria-hidden="true">
          {description}
        </small>
      )}
    </div>
  )
}

export default OLFormCheckbox
