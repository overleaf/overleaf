import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import OLFormGroup from '@/features/ui/components/ol/ol-form-group'
import OLFormLabel from '@/features/ui/components/ol/ol-form-label'
import OLFormSelect from '@/features/ui/components/ol/ol-form-select'
import { ChangeEventHandler, useCallback, useEffect, useRef } from 'react'
import { Spinner } from 'react-bootstrap-5'
import { useEditorLeftMenuContext } from '@/features/editor-left-menu/components/editor-left-menu-context'

type PossibleValue = string | number | boolean

export type Option<T extends PossibleValue = string> = {
  value: T
  label: string
  ariaHidden?: 'true' | 'false'
  disabled?: boolean
}

export type Optgroup<T extends PossibleValue = string> = {
  label: string
  options: Array<Option<T>>
}

type SettingsMenuSelectProps<T extends PossibleValue = string> = {
  label: string
  name: string
  options: Array<Option<T>>
  optgroup?: Optgroup<T>
  loading?: boolean
  onChange: (val: T) => void
  value?: T
  disabled?: boolean
}

export default function SettingsMenuSelect<T extends PossibleValue = string>({
  label,
  name,
  options,
  optgroup,
  loading,
  onChange,
  value,
  disabled = false,
}: SettingsMenuSelectProps<T>) {
  const handleChange: ChangeEventHandler<HTMLSelectElement> = useCallback(
    event => {
      const selectedValue = event.target.value
      let onChangeValue: PossibleValue = selectedValue
      if (typeof value === 'boolean') {
        onChangeValue = selectedValue === 'true'
      } else if (typeof value === 'number') {
        onChangeValue = parseInt(selectedValue, 10)
      }
      onChange(onChangeValue as T)
    },
    [onChange, value]
  )

  const { settingToFocus } = useEditorLeftMenuContext()

  const selectRef = useRef<HTMLSelectElement | null>(null)

  useEffect(() => {
    if (settingToFocus === name && selectRef.current) {
      selectRef.current.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
      selectRef.current.focus()
    }

    // clear the focus setting
    window.dispatchEvent(
      new CustomEvent('ui.focus-setting', { detail: undefined })
    )
  }, [name, settingToFocus])

  return (
    <OLFormGroup
      controlId={`settings-menu-${name}`}
      className="left-menu-setting"
    >
      <OLFormLabel>{label}</OLFormLabel>
      {loading ? (
        <BootstrapVersionSwitcher
          bs3={
            <p className="loading pull-right">
              <i className="fa fa-fw fa-spin fa-refresh" />
            </p>
          }
          bs5={
            <p className="mb-0">
              <Spinner
                animation="border"
                aria-hidden="true"
                size="sm"
                role="status"
              />
            </p>
          }
        />
      ) : (
        <OLFormSelect
          size="sm"
          onChange={handleChange}
          value={value?.toString()}
          disabled={disabled}
          ref={selectRef}
        >
          {options.map(option => (
            <option
              key={`${name}-${option.value}`}
              value={option.value.toString()}
              aria-hidden={option.ariaHidden}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
          {optgroup ? (
            <optgroup label={optgroup.label}>
              {optgroup.options.map(option => (
                <option
                  value={option.value.toString()}
                  key={option.value.toString()}
                >
                  {option.label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </OLFormSelect>
      )}
    </OLFormGroup>
  )
}
