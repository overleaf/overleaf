import { useCallback, useState, useEffect, useRef } from 'react'
import { useDetachContext } from '../context/detach-context'
import getMeta from '../../utils/meta'
import { buildUrlWithDetachRole } from '../utils/url-helper'
import * as eventTracking from '../../infrastructure/event-tracking'
import usePreviousValue from './use-previous-value'

const debugPdfDetach = getMeta('ol-debugPdfDetach')

const LINKING_TIMEOUT = 60000
const RELINK_TIMEOUT = 10000

export default function useDetachLayout() {
  const {
    role,
    setRole,
    broadcastEvent,
    addEventHandler,
    deleteEventHandler,
  } = useDetachContext()

  // isLinking: when the tab expects to be linked soon (e.g. on detach)
  const [isLinking, setIsLinking] = useState(false)

  // isLinked: when the tab is linked to another tab (of different role)
  const [isLinked, setIsLinked] = useState(false)

  const uiTimeoutRef = useRef()

  useEffect(() => {
    if (debugPdfDetach) {
      console.log('Effect', { isLinked })
    }
    setIsLinking(false)
  }, [isLinked, setIsLinking])

  useEffect(() => {
    if (uiTimeoutRef.current) {
      clearTimeout(uiTimeoutRef.current)
    }
    if (role === 'detacher' && isLinked === false) {
      // the detacher tab either a) disconnected from its detached tab(s), b)is
      // loading and no detached tab(s) is connected yet or c) is detaching and
      // waiting for the detached tab to connect.  Start a timeout to put
      // the tab back in non-detacher role in case no detached tab are connected
      uiTimeoutRef.current = setTimeout(
        () => {
          setRole(null)
        },
        isLinking ? LINKING_TIMEOUT : RELINK_TIMEOUT
      )
    }
  }, [role, isLinking, isLinked, setRole])

  useEffect(() => {
    if (debugPdfDetach) {
      console.log('Effect', { isLinking })
    }
  }, [isLinking])

  const previousRole = usePreviousValue(role)
  useEffect(() => {
    if (previousRole && !role) {
      eventTracking.sendMB('project-layout-reattached')
    }
  }, [previousRole, role])

  const reattach = useCallback(() => {
    broadcastEvent('reattach')
    setRole(null)
    setIsLinked(false)
  }, [setRole, setIsLinked, broadcastEvent])

  const detach = useCallback(() => {
    setRole('detacher')
    setIsLinking(true)

    window.open(buildUrlWithDetachRole('detached'), '_blank')
  }, [setRole, setIsLinking])

  const handleEventForDetacherFromDetached = useCallback(
    message => {
      switch (message.event) {
        case 'connected':
          broadcastEvent('up')
          setIsLinked(true)
          break
        case 'up':
          setIsLinked(true)
          break
        case 'closed':
          setIsLinked(false)
          break
      }
    },
    [setIsLinked, broadcastEvent]
  )

  const handleEventForDetachedFromDetacher = useCallback(
    message => {
      switch (message.event) {
        case 'connected':
          broadcastEvent('up')
          setIsLinked(true)
          break
        case 'up':
          setIsLinked(true)
          break
        case 'closed':
          setIsLinked(false)
          break
        case 'reattach':
          setIsLinked(false) // set as unlinked, in case closing is not allowed
          window.close()
          break
      }
    },
    [setIsLinked, broadcastEvent]
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
    isLinked,
    isLinking,
    role,
  }
}
