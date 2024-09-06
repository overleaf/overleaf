import {
  deleteJSON,
  getJSON,
  postJSON,
} from '../../../infrastructure/fetch-json'
import { FileDiff, FileRemoved } from './types/file'
import { FetchUpdatesResponse } from './types/update'
import { Label } from './types/label'
import { DocDiffResponse } from './types/doc'
import { RestoreFileResponse } from './types/restore-file'

const BATCH_SIZE = 10

export function fetchUpdates(
  projectId: string,
  before?: number,
  signal?: AbortSignal
) {
  const queryParams: Record<string, string> = {
    min_count: BATCH_SIZE.toString(),
  }

  if (before != null) {
    queryParams.before = before.toString()
  }

  const queryParamsSerialized = new URLSearchParams(queryParams).toString()
  const updatesURL = `/project/${projectId}/updates?${queryParamsSerialized}`
  return getJSON<FetchUpdatesResponse>(updatesURL, { signal })
}

export function fetchLabels(projectId: string, signal?: AbortSignal) {
  const labelsURL = `/project/${projectId}/labels`
  return getJSON<Label[]>(labelsURL, { signal })
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

export function diffFiles(
  projectId: string,
  fromV: number,
  toV: number,
  signal?: AbortSignal
) {
  const queryParams: Record<string, string> = {
    from: fromV.toString(),
    to: toV.toString(),
  }
  const queryParamsSerialized = new URLSearchParams(queryParams).toString()
  const diffUrl = `/project/${projectId}/filetree/diff?${queryParamsSerialized}`
  return getJSON<{ diff: FileDiff[] }>(diffUrl, { signal })
}

export function diffDoc(
  projectId: string,
  fromV: number,
  toV: number,
  pathname: string,
  signal?: AbortSignal
) {
  const queryParams: Record<string, string> = {
    from: fromV.toString(),
    to: toV.toString(),
    pathname,
  }
  const queryParamsSerialized = new URLSearchParams(queryParams).toString()
  const diffUrl = `/project/${projectId}/diff?${queryParamsSerialized}`
  return getJSON<DocDiffResponse>(diffUrl, { signal })
}

export function restoreFile(projectId: string, selectedFile: FileRemoved) {
  return postJSON<RestoreFileResponse>(`/project/${projectId}/restore_file`, {
    body: {
      version: selectedFile.deletedAtV,
      pathname: selectedFile.pathname,
    },
  })
}

export function restoreFileToVersion(
  projectId: string,
  pathname: string,
  version: number
) {
  return postJSON<RestoreFileResponse>(`/project/${projectId}/revert_file`, {
    body: {
      version,
      pathname,
    },
  })
}

export function restoreProjectToVersion(projectId: string, version: number) {
  return postJSON(`/project/${projectId}/revert-project`, {
    body: { version },
  })
}
