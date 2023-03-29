import { useTranslation } from 'react-i18next'

type ToggleSwitchProps = {
  labelsOnly: boolean
  setLabelsOnly: React.Dispatch<
    React.SetStateAction<ToggleSwitchProps['labelsOnly']>
  >
}

function ToggleSwitch({ labelsOnly, setLabelsOnly }: ToggleSwitchProps) {
  const { t } = useTranslation()

  return (
    <fieldset className="toggle-switch">
      <legend className="sr-only">{t('history_view_a11y_description')}</legend>
      <input
        type="radio"
        name="labels-only-toggle-switch"
        checked={!labelsOnly}
        onChange={() => setLabelsOnly(false)}
        className="toggle-switch-input"
        id="toggle-switch-all-history"
      />
      <label
        htmlFor="toggle-switch-all-history"
        className="toggle-switch-label"
      >
        <span>{t('history_view_all')}</span>
      </label>
      <input
        type="radio"
        name="labels-only-toggle-switch"
        checked={labelsOnly}
        onChange={() => setLabelsOnly(true)}
        className="toggle-switch-input"
        id="toggle-switch-labels"
      />
      <label htmlFor="toggle-switch-labels" className="toggle-switch-label">
        <span>{t('history_view_labels')}</span>
      </label>
    </fieldset>
  )
}

export default ToggleSwitch
