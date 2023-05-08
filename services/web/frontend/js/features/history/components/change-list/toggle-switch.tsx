import { useTranslation } from 'react-i18next'
import { useHistoryContext } from '../../context/history-context'
import { getUpdateForVersion } from '../../utils/history-details'
import { computeUpdateRange } from '../../utils/range'

type ToggleSwitchProps = {
  labelsOnly: boolean
  setLabelsOnly: React.Dispatch<
    React.SetStateAction<ToggleSwitchProps['labelsOnly']>
  >
}

function ToggleSwitch({ labelsOnly, setLabelsOnly }: ToggleSwitchProps) {
  const { t } = useTranslation()
  const { selection, setSelection, resetSelection, updatesInfo } =
    useHistoryContext()

  const handleChange = (isLabelsOnly: boolean) => {
    let isSelectionReset = false

    // using the switch toggle should reset the selection when in `compare` mode
    if (selection.comparing) {
      isSelectionReset = true
      resetSelection()
    }

    // in labels only mode the `fromV` is equal to `toV` value
    // switching to all history mode and triggering immediate comparison with
    // an older version would cause a bug if the computation below is skipped
    if (!isLabelsOnly && !isSelectionReset) {
      const update = selection.updateRange?.toV
        ? getUpdateForVersion(selection.updateRange.toV, updatesInfo.updates)
        : null

      const { updateRange } = selection

      if (
        updateRange &&
        update &&
        (update.fromV !== updateRange.fromV || update.toV !== updateRange.toV)
      ) {
        const range = computeUpdateRange(
          updateRange,
          update.fromV,
          update.toV,
          update.meta.end_ts
        )

        setSelection({
          updateRange: range,
          comparing: false,
          files: [],
        })
      }
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
