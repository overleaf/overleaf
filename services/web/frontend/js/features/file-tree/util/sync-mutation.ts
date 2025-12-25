import { postJSON, deleteJSON } from '../../../infrastructure/fetch-json'
import { Folder } from '@ol-types/folder'
import { Doc } from '@ol-types/doc'

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

export type NewDocEntity = {
  endpoint: 'doc'
  name: string
}

export type NewFolderEntity = {
  endpoint: 'folder'
  name: string
}

export type NewLinkedFileEntity = {
  endpoint: 'linked_file'
  name: string
  provider: string
  data: Record<string, any>
}

export type NewEntity = NewDocEntity | NewFolderEntity | NewLinkedFileEntity

type SyncCreateEntityReturn<T> = T extends NewDocEntity
  ? Promise<Doc>
  : T extends NewFolderEntity
    ? Promise<Folder>
    : T extends NewLinkedFileEntity
      ? Promise<{ new_file_id: string }>
      : never

export function syncCreateEntity<T extends NewEntity>(
  projectId: string,
  parentFolderId: string,
  newEntityData: T
): SyncCreateEntityReturn<T> {
  const { endpoint, ...newEntity } = newEntityData
  return postJSON(`/project/${projectId}/${endpoint}`, {
    body: {
      parent_folder_id: parentFolderId,
      ...newEntity,
    },
  }) as SyncCreateEntityReturn<T>
}

function getEntityPathName(entityType: string) {
  return entityType === 'fileRef' ? 'file' : entityType
}

export function syncRootDocId(projectId: string, rootDocId: string) {
  return postJSON(`/project/${projectId}/settings`, {
    body: { rootDocId },
  })
}
