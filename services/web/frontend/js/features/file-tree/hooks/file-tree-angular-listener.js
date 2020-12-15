import { useEffect } from 'react'

import { useFileTreeActionable } from '../contexts/file-tree-actionable'

// A temporary hack to listen to events dispatched from the Angular and update
// the React file tree accordingly
export function useFileTreeAngularListener() {
  const {
    finishCreatingDoc,
    finishCreatingLinkedFile
  } = useFileTreeActionable()

  useEffect(() => {
    function handleDispatchCreateDoc(ev) {
      const { ...doc } = ev.detail
      finishCreatingDoc(doc)
    }
    window.addEventListener(
      'FileTreeReactBridge.createDoc',
      handleDispatchCreateDoc
    )
    return () =>
      window.removeEventListener(
        'FileTreeReactBridge.createDoc',
        handleDispatchCreateDoc
      )
  }, [finishCreatingDoc])

  useEffect(() => {
    function handleDispatchCreateLinkedFile(ev) {
      const { ...file } = ev.detail
      finishCreatingLinkedFile(file)
    }
    window.addEventListener(
      'FileTreeReactBridge.createLinkedFile',
      handleDispatchCreateLinkedFile
    )
    return () =>
      window.removeEventListener(
        'FileTreeReactBridge.createLinkedFile',
        handleDispatchCreateLinkedFile
      )
  }, [finishCreatingLinkedFile])
}
