import { useEffect } from 'react'

import { useFileTreeMutable } from '../contexts/file-tree-mutable'
import { useFileTreeSelectable } from '../contexts/file-tree-selectable'

export function useFileTreeSocketListener() {
  const {
    dispatchRename,
    dispatchDelete,
    dispatchMove,
    dispatchCreateFolder,
    dispatchCreateDoc,
    dispatchCreateFile
  } = useFileTreeMutable()
  const { unselect } = useFileTreeSelectable()
  const socket = window._ide && window._ide.socket

  useEffect(() => {
    function handleDispatchRename(entityId, name) {
      dispatchRename(entityId, name)
    }
    if (socket) socket.on('reciveEntityRename', handleDispatchRename)
    return () => {
      if (socket)
        socket.removeListener('reciveEntityRename', handleDispatchRename)
    }
  }, [socket, dispatchRename])

  useEffect(() => {
    function handleDispatchDelete(entityId) {
      unselect(entityId)
      dispatchDelete(entityId)
    }
    if (socket) socket.on('removeEntity', handleDispatchDelete)
    return () => {
      if (socket) socket.removeListener('removeEntity', handleDispatchDelete)
    }
  }, [socket, unselect, dispatchDelete])

  useEffect(() => {
    function handleDispatchMove(entityId, toFolderId) {
      dispatchMove(entityId, toFolderId)
    }
    if (socket) socket.on('reciveEntityMove', handleDispatchMove)
    return () => {
      if (socket) socket.removeListener('reciveEntityMove', handleDispatchMove)
    }
  }, [socket, dispatchMove])

  useEffect(() => {
    function handleDispatchCreateFolder(parentFolderId, folder) {
      dispatchCreateFolder(parentFolderId, folder)
    }
    if (socket) socket.on('reciveNewFolder', handleDispatchCreateFolder)
    return () => {
      if (socket)
        socket.removeListener('reciveNewFolder', handleDispatchCreateFolder)
    }
  }, [socket, dispatchCreateFolder])

  useEffect(() => {
    function handleDispatchCreateDoc(parentFolderId, doc) {
      dispatchCreateDoc(parentFolderId, doc)
    }
    if (socket) socket.on('reciveNewDoc', handleDispatchCreateDoc)
    return () => {
      if (socket) socket.removeListener('reciveNewDoc', handleDispatchCreateDoc)
    }
  }, [socket, dispatchCreateDoc])

  useEffect(() => {
    function handleDispatchCreateFile(parentFolderId, file) {
      dispatchCreateFile(parentFolderId, file)
    }
    if (socket) socket.on('reciveNewFile', handleDispatchCreateFile)
    return () => {
      if (socket)
        socket.removeListener('reciveNewFile', handleDispatchCreateFile)
    }
  }, [socket, dispatchCreateFile])
}
