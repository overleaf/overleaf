import classNames from 'classnames'

export function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span>
      {keys.map((key, idx) => (
        <span
          className={classNames({
            'dropdown-shortcut-char': key.length === 1,
          })}
          key={`${key}${idx}`}
        >
          {key}
        </span>
      ))}
    </span>
  )
}
