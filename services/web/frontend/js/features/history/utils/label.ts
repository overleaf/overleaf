import { orderBy } from 'lodash'
import { Label, PseudoCurrentStateLabel } from '../services/types/update'
import { Nullable } from '../../../../../types/utils'

export const isPseudoLabel = (
  label: Label | PseudoCurrentStateLabel
): label is PseudoCurrentStateLabel => {
  return (label as PseudoCurrentStateLabel).isPseudoCurrentStateLabel === true
}

const sortLabelsByVersionAndDate = (
  labels: Array<Label | PseudoCurrentStateLabel>
) => {
  return orderBy(
    labels,
    ['isPseudoCurrentStateLabel', 'version', 'created_at'],
    ['asc', 'desc', 'desc']
  )
}

const deletePseudoCurrentStateLabelIfExistent = (
  labels: Array<Label | PseudoCurrentStateLabel>
) => {
  if (labels.length && isPseudoLabel(labels[0])) {
    const [, ...rest] = labels
    return rest
  }
  return labels
}

const addPseudoCurrentStateLabelIfNeeded = (
  labels: Array<Label | PseudoCurrentStateLabel>,
  mostRecentVersion: Nullable<number>
) => {
  if (!labels.length || labels[0].version !== mostRecentVersion) {
    const pseudoCurrentStateLabel: PseudoCurrentStateLabel = {
      id: '1',
      isPseudoCurrentStateLabel: true,
      version: mostRecentVersion,
      created_at: new Date().toISOString(),
    }
    return [pseudoCurrentStateLabel, ...labels]
  }
  return labels
}

export const loadLabels = (
  labels: Label[],
  lastUpdateToV: Nullable<number>
) => {
  const sortedLabels = sortLabelsByVersionAndDate(labels)
  const labelsWithoutPseudoLabel =
    deletePseudoCurrentStateLabelIfExistent(sortedLabels)
  const labelsWithPseudoLabelIfNeeded = addPseudoCurrentStateLabelIfNeeded(
    labelsWithoutPseudoLabel,
    lastUpdateToV
  )

  return labelsWithPseudoLabelIfNeeded
}
