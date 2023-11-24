import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

export function Stepper({ steps, active }: { steps: number; active: number }) {
  const { t } = useTranslation()
  return (
    <div
      className="stepper"
      role="progressbar"
      aria-label={t('progress_bar_percentage')}
      aria-valuenow={active + 1}
      aria-valuemax={steps}
      tabIndex={0}
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
