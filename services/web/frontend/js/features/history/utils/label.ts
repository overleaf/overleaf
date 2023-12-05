import { orderBy, groupBy } from 'lodash'
import {
  LoadedLabel,
  Label,
  PseudoCurrentStateLabel,
} from '../services/types/label'
import { Nullable } from '../../../../../types/utils'
import { Selection } from '../services/types/selection'
import { Update } from '../services/types/update'

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
      lastUpdatedTimestamp: null,
    }
    return [pseudoCurrentStateLabel, ...labels]
  }
  return labels
}

const addLastUpdatedTimestamp = (labels: LoadedLabel[], updates: Update[]) => {
  return labels.map(label => {
    const lastUpdatedTimestamp = updates.find(update =>
      update.labels.find(l => l.id === label.id)
    )?.meta.end_ts

    return {
      ...label,
      lastUpdatedTimestamp: lastUpdatedTimestamp || null,
    }
  })
}

export const loadLabels = (labels: Label[], updates: Update[]) => {
  const lastUpdateToV = updates.length ? updates[0].toV : null
  const sortedLabels = sortLabelsByVersionAndDate(labels)
  const labelsWithoutPseudoLabel =
    deletePseudoCurrentStateLabelIfExistent(sortedLabels)
  const labelsWithPseudoLabelIfNeeded = addPseudoCurrentStateLabelIfNeeded(
    labelsWithoutPseudoLabel,
    lastUpdateToV
  )
  const labelsWithLastUpdatedTimestamp = addLastUpdatedTimestamp(
    labelsWithPseudoLabelIfNeeded,
    updates
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
