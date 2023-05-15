import { FC, createContext, useContext } from 'react'

const SwitcherContext = createContext<
  | {
      name: string
      onChange?: (value: string) => any
      defaultValue?: string
      disabled: boolean
    }
  | undefined
>(undefined)

export const Switcher: FC<{
  name: string
  onChange?: (value: string) => any
  defaultValue?: string
  disabled?: boolean
}> = ({ name, children, onChange, defaultValue, disabled = false }) => {
  return (
    <SwitcherContext.Provider
      value={{ name, onChange, defaultValue, disabled }}
    >
      <fieldset>{children}</fieldset>
    </SwitcherContext.Provider>
  )
}

export const SwitcherItem: FC<{
  value: string
  label: string
  checked?: boolean
}> = ({ value, label, checked = false }) => {
  const ctx = useContext(SwitcherContext)
  if (!ctx) {
    throw new Error('SwitcherItem must be a child of Switcher')
  }
  const { name, onChange, defaultValue, disabled } = ctx

  const id = `${name}-option-${value.replace(/\W/g, '')}`
  return (
    <>
      <input
        type="radio"
        value={value}
        id={id}
        className="switcher-input"
        name={name}
        defaultChecked={!disabled && (checked || defaultValue === value)}
        disabled={disabled}
        onChange={evt => {
          if (onChange) {
            onChange(evt.target.value)
          }
        }}
      />
      <label htmlFor={id} className="switcher-label" aria-disabled={disabled}>
        <span>{label}</span>
      </label>
    </>
  )
}
