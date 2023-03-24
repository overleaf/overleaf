import { getJSON } from '../../../infrastructure/fetch-json'
import { FileDiff } from './types/file'
import { Update } from './types/update'

const BATCH_SIZE = 10

export function fetchUpdates(projectId: string, before?: number) {
  const queryParams: Record<string, string> = {
    min_count: BATCH_SIZE.toString(),
  }

  if (before != null) {
    queryParams.before = before.toString()
  }

  const queryParamsSerialized = new URLSearchParams(queryParams).toString()
  const updatesURL = `/project/${projectId}/updates?${queryParamsSerialized}`
  return getJSON<{ updates: Update[] }>(updatesURL)
}

export function diffFiles(projectId: string, fromV: number, toV: number) {
  const queryParams: Record<string, string> = {
    from: fromV.toString(),
    to: toV.toString(),
  }
  const queryParamsSerialized = new URLSearchParams(queryParams).toString()
  const diffUrl = `/project/${projectId}/filetree/diff?${queryParamsSerialized}`
  return getJSON<{ diff: FileDiff[] }>(diffUrl)
}
