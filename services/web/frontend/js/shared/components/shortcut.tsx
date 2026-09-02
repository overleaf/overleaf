export function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className="dropdown-shortcut">
      {keys.map((key, idx) => (
        <span key={`${key}${idx}`}>{key}</span>
      ))}
    </span>
  )
}
