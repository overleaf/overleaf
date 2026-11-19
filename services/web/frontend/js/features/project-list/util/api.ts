import { Tag } from '../../../../../app/src/Features/Tags/types'
import {
  GetProjectsResponseBody,
  LocalSyncSettings,
  ProjectLocalFolderInfo,
  Sort,
} from '../../../../../types/project/dashboard/api'
import {
  deleteJSON,
  getJSON,
  postJSON,
} from '../../../infrastructure/fetch-json'

export function getProjects(sortBy: Sort): Promise<GetProjectsResponseBody> {
  return postJSON('/api/project', { body: { sort: sortBy } })
}

export function createTag(name: string, color?: string): Promise<Tag> {
  return postJSON(`/tag`, {
    body: { name, color },
  })
}

export function editTag(
  tagId: string,
  newTagName: string,
  newTagColor?: string
) {
  return postJSON(`/tag/${tagId}/edit`, {
    body: { name: newTagName, color: newTagColor },
  })
}

export function deleteTag(tagId: string) {
  return deleteJSON(`/tag/${tagId}`)
}

export function addProjectsToTag(tagId: string, projectIds: string[]) {
  return postJSON(`/tag/${tagId}/projects`, {
    body: {
      projectIds,
    },
  })
}

export function removeProjectFromTag(tagId: string, projectId: string) {
  return deleteJSON(`/tag/${tagId}/project/${projectId}`)
}

export function removeProjectsFromTag(tagId: string, projectIds: string[]) {
  return postJSON(`/tag/${tagId}/projects/remove`, {
    body: {
      projectIds,
    },
  })
}

export function archiveProject(projectId: string) {
  return postJSON(`/project/${projectId}/archive`)
}

export function deleteProject(projectId: string) {
  return deleteJSON(`/project/${projectId}`)
}

export function leaveProject(projectId: string) {
  return postJSON(`/project/${projectId}/leave`)
}

export function renameProject(projectId: string, newName: string) {
  return postJSON(`/project/${projectId}/rename`, {
    body: {
      newProjectName: newName,
    },
  })
}

export function trashProject(projectId: string) {
  return postJSON(`/project/${projectId}/trash`)
}

export function unarchiveProject(projectId: string) {
  return deleteJSON(`/project/${projectId}/archive`)
}

export function untrashProject(projectId: string) {
  return deleteJSON(`/project/${projectId}/trash`)
}

export type BrowseDirectoriesResponse = {
  ok: boolean
  currentPath: string
  parentPath: string | null
  allowedRoot: string
  defaultBaseDir: string
  directories: Array<{ name: string; path: string }>
}

export function getLocalSyncSettings(): Promise<LocalSyncSettings> {
  return getJSON('/api/local-sync/settings')
}

export function updateLocalSyncBaseDir(body: {
  baseDir: string
  syncAll?: boolean
  cleanOld?: boolean
}): Promise<{
  settings: LocalSyncSettings
  previousBaseDir: string
  syncedCount: number
  failedCount: number
}> {
  return postJSON('/api/local-sync/settings', { body })
}

export function syncAllLocalProjects(): Promise<{
  ok: boolean
  total: number
  syncedCount: number
  failedCount: number
}> {
  return postJSON('/api/local-sync/sync-all')
}

export function browseLocalDirectories(
  dirPath?: string
): Promise<BrowseDirectoriesResponse> {
  const q = dirPath ? `?path=${encodeURIComponent(dirPath)}` : ''
  return getJSON(`/api/local-sync/browse${q}`)
}

export function createLocalDirectory(
  dirPath: string
): Promise<{ ok: boolean; normalizedPath: string }> {
  return postJSON('/api/local-sync/mkdir', { body: { path: dirPath } })
}

export function updateProjectLocalFolder(
  projectId: string,
  body: {
    customFolderPath: string | null
    syncEnabled?: boolean
    syncNow?: boolean
    cleanOld?: boolean
  }
): Promise<{
  ok: boolean
  localFolder: ProjectLocalFolderInfo
  syncResult?: { syncedFilesCount?: number } | null
}> {
  return postJSON(`/project/${projectId}/local-folder`, { body })
}

export function syncProjectToLocalFolder(projectId: string): Promise<{
  ok: boolean
  localFolder: ProjectLocalFolderInfo
  syncResult?: { syncedFilesCount?: number }
}> {
  return postJSON(`/project/${projectId}/local-sync`)
}
