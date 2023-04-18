import { orderBy } from 'lodash'
import {
  LoadedLabel,
  Label,
  PseudoCurrentStateLabel,
} from '../services/types/label'
import { Nullable } from '../../../../../types/utils'

export const isPseudoLabel = (
  label: LoadedLabel
): label is PseudoCurrentStateLabel => {
  return (label as PseudoCurrentStateLabel).isPseudoCurrentStateLabel === true
}

export const isLabel = (label: LoadedLabel): label is Label => {
  return !isPseudoLabel(label)
}

const sortLabelsByVersionAndDate = (labels: LoadedLabel[]) => {
  return orderBy(
    labels,
    ['isPseudoCurrentStateLabel', 'version', 'created_at'],
    ['asc', 'desc', 'desc']
  )
}

const deletePseudoCurrentStateLabelIfExistent = (labels: LoadedLabel[]) => {
  if (labels.length && isPseudoLabel(labels[0])) {
    const [, ...rest] = labels
    return rest
  }
  return labels
}

const addPseudoCurrentStateLabelIfNeeded = (
  labels: LoadedLabel[],
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
