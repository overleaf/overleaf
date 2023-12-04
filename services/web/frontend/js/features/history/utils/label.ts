import { orderBy, groupBy } from 'lodash'
import {
  LoadedLabel,
  Label,
  PseudoCurrentStateLabel,
} from '../services/types/label'
import { Nullable } from '../../../../../types/utils'
import { Selection } from '../services/types/selection'

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
  mostRecentVersion: Nullable<number>,
  lastUpdatedTimestamp: Nullable<number>
) => {
  if (!labels.length || labels[0].version !== mostRecentVersion) {
    const pseudoCurrentStateLabel: PseudoCurrentStateLabel = {
      id: '1',
      isPseudoCurrentStateLabel: true,
      version: mostRecentVersion,
      created_at: new Date().toISOString(),
      lastUpdatedTimestamp,
    }
    return [pseudoCurrentStateLabel, ...labels]
  }
  return labels
}

const addLastUpdatedTimestamp = (
  labels: LoadedLabel[],
  lastUpdatedTimestamp: Nullable<number>
) => {
  return labels.map(label => ({
    ...label,
    lastUpdatedTimestamp,
  }))
}

export const loadLabels = (
  labels: Label[],
  lastUpdateToV: Nullable<number>,
  lastUpdatedTimestamp: Nullable<number>
) => {
  const sortedLabels = sortLabelsByVersionAndDate(labels)
  const labelsWithoutPseudoLabel =
    deletePseudoCurrentStateLabelIfExistent(sortedLabels)
  const labelsWithPseudoLabelIfNeeded = addPseudoCurrentStateLabelIfNeeded(
    labelsWithoutPseudoLabel,
    lastUpdateToV,
    lastUpdatedTimestamp
  )
  const labelsWithLastUpdatedTimestamp = addLastUpdatedTimestamp(
    labelsWithPseudoLabelIfNeeded,
    lastUpdatedTimestamp
  )
  return labelsWithLastUpdatedTimestamp
}

export const getVersionWithLabels = (labels: Nullable<LoadedLabel[]>) => {
  let versionWithLabels: { version: number; labels: LoadedLabel[] }[] = []

  if (labels) {
    const groupedLabelsHash = groupBy(labels, 'version')
    versionWithLabels = Object.keys(groupedLabelsHash).map(key => ({
      version: parseInt(key, 10),
      labels: groupedLabelsHash[key],
    }))
    versionWithLabels = orderBy(versionWithLabels, ['version'], ['desc'])
  }

  return versionWithLabels
}

export const isAnyVersionMatchingSelection = (
  labels: Nullable<LoadedLabel[]>,
  selection: Selection
) => {
  // build an Array<number> of available versions
  const versions = getVersionWithLabels(labels).map(v => v.version)
  const selectedVersion = selection.updateRange?.toV

  return selectedVersion && !versions.includes(selectedVersion)
}
