export default function Setting({
  label,
  controlId,
  children,
  description = undefined,
}: {
  label: string
  description: string | undefined
  controlId: string
  children: React.ReactNode
}) {
  return (
    <div className="ide-setting">
      <div>
        <label htmlFor={controlId} className="ide-setting-title">
          {label}
        </label>
        {description && (
          <div className="ide-setting-description">{description}</div>
        )}
      </div>
      {children}
    </div>
  )
}
