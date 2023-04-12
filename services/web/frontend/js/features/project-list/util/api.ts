import { Tag } from '../../../../../app/src/Features/Tags/types'
import {
  GetProjectsResponseBody,
  Sort,
} from '../../../../../types/project/dashboard/api'
import { deleteJSON, postJSON } from '../../../infrastructure/fetch-json'

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
  return deleteJSON(`/tag/${tagId}/projects`, {
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
