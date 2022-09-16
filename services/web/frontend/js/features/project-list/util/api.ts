import { Tag } from '../../../../../app/src/Features/Tags/types'
import {
  GetProjectsResponseBody,
  Sort,
} from '../../../../../types/project/dashboard/api'
import { deleteJSON, postJSON } from '../../../infrastructure/fetch-json'

export function getProjects(sortBy: Sort): Promise<GetProjectsResponseBody> {
  return postJSON('/api/project', { body: { sort: sortBy } })
}

export function createTag(tagName: string): Promise<Tag> {
  return postJSON(`/tag`, {
    body: { name: tagName, _csrf: window.csrfToken },
  })
}

export function renameTag(tagId: string, newTagName: string) {
  return postJSON(`/tag/${tagId}/rename`, {
    body: { name: newTagName, _csrf: window.csrfToken },
  })
}

export function deleteTag(tagId: string) {
  return deleteJSON(`/tag/${tagId}`, { body: { _csrf: window.csrfToken } })
}

export function archiveProject(projectId: string) {
  return postJSON(`/project/${projectId}/archive`, {
    body: {
      _csrf: window.csrfToken,
    },
  })
}

export function deleteProject(projectId: string) {
  return deleteJSON(`/project/${projectId}`, {
    body: {
      _csrf: window.csrfToken,
    },
  })
}

export function leaveProject(projectId: string) {
  return postJSON(`/project/${projectId}/leave`, {
    body: {
      _csrf: window.csrfToken,
    },
  })
}

export function trashProject(projectId: string) {
  return postJSON(`/project/${projectId}/trash`, {
    body: {
      _csrf: window.csrfToken,
    },
  })
}

export function unarchiveProject(projectId: string) {
  return deleteJSON(`/project/${projectId}/archive`, {
    body: {
      _csrf: window.csrfToken,
    },
  })
}

export function untrashProject(projectId: string) {
  return deleteJSON(`/project/${projectId}/trash`, {
    body: {
      _csrf: window.csrfToken,
    },
  })
}
