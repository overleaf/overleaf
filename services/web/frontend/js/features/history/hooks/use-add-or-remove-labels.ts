import { useHistoryContext } from '../context/history-context'
import {
  isAnyVersionMatchingSelection,
  isLabel,
  loadLabels,
} from '../utils/label'
import { Label } from '../services/types/label'

function useAddOrRemoveLabels() {
  const {
    updatesInfo,
    setUpdatesInfo,
    labels,
    setLabels,
    selection,
    resetSelection,
  } = useHistoryContext()

  const addOrRemoveLabel = (
    label: Label,
    labelsHandler: (label: Label[]) => Label[]
  ) => {
    const tempUpdates = [...updatesInfo.updates]
    for (const [i, update] of tempUpdates.entries()) {
      if (update.toV === label.version) {
        tempUpdates[i] = {
          ...update,
          labels: labelsHandler(update.labels),
        }
        break
      }
    }

    setUpdatesInfo({ ...updatesInfo, updates: tempUpdates })

    if (labels) {
      const nonPseudoLabels = labels.filter(isLabel)
      const processedNonPseudoLabels = labelsHandler(nonPseudoLabels)
      const newLabels = loadLabels(processedNonPseudoLabels, tempUpdates[0].toV)
      setLabels(newLabels)

      return newLabels
    }
    return null
  }

  const addUpdateLabel = (label: Label) => {
    const labelHandler = (labels: Label[]) => labels.concat(label)
    addOrRemoveLabel(label, labelHandler)
  }

  const removeUpdateLabel = (label: Label) => {
    const labelHandler = (labels: Label[]) =>
      labels.filter(({ id }) => id !== label.id)
    const newLabels = addOrRemoveLabel(label, labelHandler)

    // removing all labels from current selection should reset the selection
    if (isAnyVersionMatchingSelection(newLabels, selection)) {
      resetSelection()
    }
  }

  return { addUpdateLabel, removeUpdateLabel }
}

export default useAddOrRemoveLabels
