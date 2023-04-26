import { useTranslation } from 'react-i18next'
import { useHistoryContext } from '../../context/history-context'

type ToggleSwitchProps = {
  labelsOnly: boolean
  setLabelsOnly: React.Dispatch<
    React.SetStateAction<ToggleSwitchProps['labelsOnly']>
  >
}

function ToggleSwitch({ labelsOnly, setLabelsOnly }: ToggleSwitchProps) {
  const { t } = useTranslation()
  const { resetSelection, selection } = useHistoryContext()

  const handleChange = (isLabelsOnly: boolean) => {
    if (selection.comparing) {
      resetSelection()
    }

    setLabelsOnly(isLabelsOnly)
  }

  return (
    <fieldset className="toggle-switch">
      <legend className="sr-only">{t('history_view_a11y_description')}</legend>
      <input
        type="radio"
        name="labels-only-toggle-switch"
        checked={!labelsOnly}
        onChange={() => handleChange(false)}
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
        onChange={() => handleChange(true)}
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
