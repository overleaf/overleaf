import { useCallback, useEffect } from 'react'

import { useUserContext } from '../../../shared/context/user-context'
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'
import { useFileTreeSelectable } from '../contexts/file-tree-selectable'
import { findInTree, findInTreeOrThrow } from '../util/find-in-tree'
import { useIdeContext } from '@/shared/context/ide-context'
import { useSnapshotContext } from '@/features/ide-react/context/snapshot-context'

export function useFileTreeSocketListener(onDelete: (entity: any) => void) {
  const user = useUserContext()
  const {
    dispatchRename,
    dispatchDelete,
    dispatchMove,
    dispatchCreateFolder,
    dispatchCreateDoc,
    dispatchCreateFile,
    fileTreeData,
  } = useFileTreeData()
  const { selectedEntityIds, selectedEntityParentIds, select, unselect } =
    useFileTreeSelectable()
  const { socket } = useIdeContext()
  const { fileTreeFromHistory } = useSnapshotContext()

  const selectEntityIfCreatedByUser = useCallback(
    // hack to automatically re-open refreshed linked files
    (entityId, entityName, userId) => {
      // If the created entity's user exists and is the current user
      if (userId && user?.id === userId) {
        // And we're expecting a refreshed socket for this entity
        if (window.expectingLinkedFileRefreshedSocketFor === entityName) {
          // Then select it
          select(entityId)
          window.expectingLinkedFileRefreshedSocketFor = null
        }
      }
    },
    [user, select]
  )

  useEffect(() => {
    if (fileTreeFromHistory) return
    function handleDispatchRename(entityId: string, name: string) {
      dispatchRename(entityId, name)
    }
    if (socket) socket.on('reciveEntityRename', handleDispatchRename)
    return () => {
      if (socket)
        socket.removeListener('reciveEntityRename', handleDispatchRename)
    }
  }, [socket, dispatchRename, fileTreeFromHistory])

  useEffect(() => {
    if (fileTreeFromHistory) return
    function handleDispatchDelete(entityId: string) {
      const entity = findInTree(fileTreeData, entityId)
      unselect(entityId)
      if (selectedEntityParentIds.has(entityId)) {
        // we're deleting a folder with a selected children so we need to
        // unselect its selected children first
        for (const selectedEntityId of selectedEntityIds) {
          if (
            findInTreeOrThrow(fileTreeData, selectedEntityId).path.includes(
              entityId
            )
          ) {
            unselect(selectedEntityId)
          }
        }
      }
      dispatchDelete(entityId)
      if (onDelete) {
        onDelete(entity)
      }
    }
    if (socket) socket.on('removeEntity', handleDispatchDelete)
    return () => {
      if (socket) socket.removeListener('removeEntity', handleDispatchDelete)
    }
  }, [
    socket,
    unselect,
    dispatchDelete,
    fileTreeData,
    selectedEntityIds,
    selectedEntityParentIds,
    onDelete,
    fileTreeFromHistory,
  ])

  useEffect(() => {
    if (fileTreeFromHistory) return
    function handleDispatchMove(entityId: string, toFolderId: string) {
      dispatchMove(entityId, toFolderId)
    }
    if (socket) socket.on('reciveEntityMove', handleDispatchMove)
    return () => {
      if (socket) socket.removeListener('reciveEntityMove', handleDispatchMove)
    }
  }, [socket, dispatchMove, fileTreeFromHistory])

  useEffect(() => {
    if (fileTreeFromHistory) return
    function handleDispatchCreateFolder(parentFolderId: string, folder: any) {
      dispatchCreateFolder(parentFolderId, folder)
    }
    if (socket) socket.on('reciveNewFolder', handleDispatchCreateFolder)
    return () => {
      if (socket)
        socket.removeListener('reciveNewFolder', handleDispatchCreateFolder)
    }
  }, [socket, dispatchCreateFolder, fileTreeFromHistory])

  useEffect(() => {
    if (fileTreeFromHistory) return
    function handleDispatchCreateDoc(
      parentFolderId: string,
      doc: any,
      _source: unknown
    ) {
      dispatchCreateDoc(parentFolderId, doc)
    }
    if (socket) socket.on('reciveNewDoc', handleDispatchCreateDoc)
    return () => {
      if (socket) socket.removeListener('reciveNewDoc', handleDispatchCreateDoc)
    }
  }, [socket, dispatchCreateDoc, fileTreeFromHistory])

  useEffect(() => {
    if (fileTreeFromHistory) return
    function handleDispatchCreateFile(
      parentFolderId: string,
      file: any,
      _source: unknown,
      linkedFileData: any,
      userId: string
    ) {
      dispatchCreateFile(parentFolderId, file)
      if (linkedFileData) {
        selectEntityIfCreatedByUser(file._id, file.name, userId)
      }
    }
    if (socket) socket.on('reciveNewFile', handleDispatchCreateFile)
    return () => {
      if (socket)
        socket.removeListener('reciveNewFile', handleDispatchCreateFile)
    }
  }, [
    socket,
    dispatchCreateFile,
    selectEntityIfCreatedByUser,
    fileTreeFromHistory,
  ])
}
