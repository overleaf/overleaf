import React from 'react'
import Setting from './setting'
import OLFormSwitch from '@/shared/components/ol/ol-form-switch'

export default function ToggleSetting({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: React.ReactNode
  description: React.ReactNode
  checked: boolean | undefined
  onChange: (newValue: boolean) => void
  disabled?: boolean
}) {
  const handleChange = () => {
    onChange(!checked)
  }

  return (
    <Setting controlId={id} label={label} description={description}>
      <OLFormSwitch
        id={id}
        onChange={handleChange}
        checked={checked}
        label={label}
        disabled={disabled}
      />
    </Setting>
  )
}
