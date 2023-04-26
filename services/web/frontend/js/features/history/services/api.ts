import {
  deleteJSON,
  getJSON,
  postJSON,
} from '../../../infrastructure/fetch-json'
import { FileDiff } from './types/file'
import { FetchUpdatesResponse } from './types/update'
import { Label } from './types/label'
import { DocDiffResponse } from './types/doc'

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
  return getJSON<FetchUpdatesResponse>(updatesURL)
}

export function fetchLabels(projectId: string) {
  const labelsURL = `/project/${projectId}/labels`
  return getJSON<Label[]>(labelsURL)
}

export function addLabel(
  projectId: string,
  body: { comment: string; version: number },
  signal?: AbortSignal
) {
  return postJSON(`/project/${projectId}/labels`, { body, signal })
}

export function deleteLabel(
  projectId: string,
  labelId: string,
  signal?: AbortSignal
) {
  return deleteJSON(`/project/${projectId}/labels/${labelId}`, { signal })
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

export function diffDoc(
  projectId: string,
  fromV: number,
  toV: number,
  pathname: string
) {
  const queryParams: Record<string, string> = {
    from: fromV.toString(),
    to: toV.toString(),
    pathname,
  }
  const queryParamsSerialized = new URLSearchParams(queryParams).toString()
  const diffUrl = `/project/${projectId}/diff?${queryParamsSerialized}`
  return getJSON<DocDiffResponse>(diffUrl)
}
