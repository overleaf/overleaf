export default function Setting({
  label,
  description,
  controlId,
  children,
}: {
  label: string
  description: string
  controlId: string
  children: React.ReactNode
}) {
  return (
    <div className="ide-setting">
      <div>
        <label htmlFor={controlId} className="ide-setting-title">
          {label}
        </label>
        <div className="ide-setting-description">{description}</div>
      </div>
      {children}
    </div>
  )
}
