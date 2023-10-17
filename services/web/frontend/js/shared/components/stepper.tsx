import classNames from 'classnames'

export function Stepper({ steps, active }: { steps: number; active: number }) {
  return (
    <div
      className="stepper"
      role="progressbar"
      aria-valuenow={active + 1}
      aria-valuemax={steps}
    >
      {Array.from({ length: steps }).map((_, i) => (
        <div
          key={i}
          className={classNames({
            step: true,
            active: i === active,
            completed: i < active,
          })}
        />
      ))}
    </div>
  )
}
