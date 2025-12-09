import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

export function CiamStepper({
  steps,
  active,
}: {
  steps: number
  active: number
}) {
  const { t } = useTranslation()
  return (
    <div className="ciam-stepper-container">
      <div
        className="ciam-stepper"
        role="progressbar"
        aria-label={t('progress_bar_percentage')}
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
    </div>
  )
}
