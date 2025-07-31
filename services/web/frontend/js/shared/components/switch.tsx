import classNames from 'classnames'

type SwitchProps = {
  onChange: () => void
  checked: boolean
  disabled?: boolean
}

function Switch({ onChange, checked, disabled = false }: SwitchProps) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className={classNames('switch-input', { disabled })}>
      <input
        className="invisible-input"
        type="checkbox"
        role="switch"
        autoComplete="off"
        onChange={onChange}
        checked={checked}
        disabled={disabled}
      />
      <span className="switch" />
    </label>
  )
}

export default Switch
