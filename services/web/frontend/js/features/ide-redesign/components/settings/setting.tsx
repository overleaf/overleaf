import React from 'react'

export default function Setting({
  label,
  controlId,
  children,
  description = undefined,
}: {
  label: React.ReactNode
  description: React.ReactNode | undefined
  controlId: string
  children: React.ReactNode
}) {
  return (
    <div id={`setting-${controlId}`} className="ide-setting">
      <div>
        <label htmlFor={controlId} className="ide-setting-title">
          {label}
        </label>
        {description && (
          <div className="ide-setting-description">{description}</div>
        )}
      </div>
      <div className="ide-setting-input">{children}</div>
    </div>
  )
}
