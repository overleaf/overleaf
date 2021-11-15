import { useCallback, useState, useEffect } from 'react'
import { useDetachContext } from '../context/detach-context'
import getMeta from '../../utils/meta'
import { buildUrlWithDetachRole } from '../utils/url-helper'

const debugPdfDetach = getMeta('ol-debugPdfDetach')

export default function useDetachLayout() {
  const {
    role,
    setRole,
    broadcastEvent,
    addEventHandler,
    deleteEventHandler,
  } = useDetachContext()

  const [mode, setMode] = useState(() => {
    if (role === 'detacher') {
      return 'detaching'
    }
    if (role === 'detached') {
      return 'orphan'
    }
  })

  useEffect(() => {
    if (debugPdfDetach) {
      console.log('Effect', { mode })
    }
  }, [mode])

  const reattach = useCallback(() => {
    broadcastEvent('reattach')
    setRole(null)
    setMode(null)
  }, [setRole, setMode, broadcastEvent])

  const detach = useCallback(() => {
    setRole('detacher')
    setMode('detaching')

    window.open(buildUrlWithDetachRole('detached'), '_blank')
  }, [setRole, setMode])

  const handleEventForDetacherFromDetached = useCallback(
    message => {
      switch (message.event) {
        case 'connected':
          broadcastEvent('up')
          setMode('detacher')
          break
        case 'up':
          setMode('detacher')
          break
        case 'closed':
          setMode(null)
          break
      }
    },
    [setMode, broadcastEvent]
  )

  const handleEventForDetachedFromDetacher = useCallback(
    message => {
      switch (message.event) {
        case 'connected':
          broadcastEvent('up')
          setMode('detached')
          break
        case 'up':
          setMode('detached')
          break
        case 'closed':
          setMode('orphan')
          break
        case 'reattach':
          window.close()
          break
      }
    },
    [setMode, broadcastEvent]
  )

  const handleEventFromSelf = useCallback(
    message => {
      switch (message.event) {
        case 'closed':
          broadcastEvent('up')
          break
      }
    },
    [broadcastEvent]
  )

  const handleEvent = useCallback(
    message => {
      if (role === 'detacher') {
        if (message.role === 'detacher') {
          handleEventFromSelf(message)
        } else if (message.role === 'detached') {
          handleEventForDetacherFromDetached(message)
        }
      } else if (role === 'detached') {
        if (message.role === 'detacher') {
          handleEventForDetachedFromDetacher(message)
        } else if (message.role === 'detached') {
          handleEventFromSelf(message)
        }
      }
    },
    [
      role,
      handleEventForDetacherFromDetached,
      handleEventForDetachedFromDetacher,
      handleEventFromSelf,
    ]
  )

  useEffect(() => {
    addEventHandler(handleEvent)
    return () => deleteEventHandler(handleEvent)
  }, [addEventHandler, deleteEventHandler, handleEvent])

  return {
    reattach,
    detach,
    mode,
    role,
  }
}
