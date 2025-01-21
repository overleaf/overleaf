import { postJSON, deleteJSON } from '../../../infrastructure/fetch-json'

export function syncRename(
  projectId: string,
  entityType: string,
  entityId: string,
  newName: string
) {
  return postJSON(
    `/project/${projectId}/${getEntityPathName(entityType)}/${entityId}/rename`,
    {
      body: {
        name: newName,
      },
    }
  )
}

export function syncDelete(
  projectId: string,
  entityType: string,
  entityId: string
) {
  return deleteJSON(
    `/project/${projectId}/${getEntityPathName(entityType)}/${entityId}`
  )
}

export function syncMove(
  projectId: string,
  entityType: string,
  entityId: string,
  toFolderId: string
) {
  return postJSON(
    `/project/${projectId}/${getEntityPathName(entityType)}/${entityId}/move`,
    {
      body: {
        folder_id: toFolderId,
      },
    }
  )
}

export function syncCreateEntity(
  projectId: string,
  parentFolderId: string,
  newEntityData: {
    endpoint: 'doc' | 'folder' | 'linked-file'
    [key: string]: unknown
  }
) {
  const { endpoint, ...newEntity } = newEntityData
  return postJSON(`/project/${projectId}/${endpoint}`, {
    body: {
      parent_folder_id: parentFolderId,
      ...newEntity,
    },
  })
}

function getEntityPathName(entityType: string) {
  return entityType === 'fileRef' ? 'file' : entityType
}
