import { useHistoryContext } from '../context/history-context'
import { isLabel, loadLabels } from '../utils/label'
import { Label } from '../services/types/label'

function useAddOrRemoveLabels() {
  const { updatesInfo, setUpdatesInfo, labels, setLabels } = useHistoryContext()

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
      setLabels(loadLabels(processedNonPseudoLabels, tempUpdates[0].toV))
    }
  }

  const addUpdateLabel = (label: Label) => {
    const labelHandler = (labels: Label[]) => labels.concat(label)
    addOrRemoveLabel(label, labelHandler)
  }

  const removeUpdateLabel = (label: Label) => {
    const labelHandler = (labels: Label[]) =>
      labels.filter(({ id }) => id !== label.id)
    addOrRemoveLabel(label, labelHandler)
  }

  return { addUpdateLabel, removeUpdateLabel }
}

export default useAddOrRemoveLabels
