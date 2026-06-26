export default function SettingsSection({
  children,
  title,
}: {
  children: React.ReactNode | React.ReactNode[]
  title?: string
}) {
  if (!children) {
    return null
  }

  return (
    <div className="ide-settings-section">
      {title && <div className="ide-settings-section-title">{title}</div>}
      {children}
    </div>
  )
}
