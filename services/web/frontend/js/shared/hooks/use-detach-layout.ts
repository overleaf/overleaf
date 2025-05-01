import { useCallback, useState, useEffect, useRef } from 'react'
import { useDetachContext } from '../context/detach-context'
import getMeta from '../../utils/meta'
import { buildUrlWithDetachRole } from '../utils/url-helper'
import * as eventTracking from '../../infrastructure/event-tracking'
import usePreviousValue from './use-previous-value'
import { debugConsole } from '@/utils/debugging'

const debugPdfDetach = getMeta('ol-debugPdfDetach')

const LINKING_TIMEOUT = 60000
const RELINK_TIMEOUT = 10000

export default function useDetachLayout() {
  const { role, setRole, broadcastEvent, addEventHandler, deleteEventHandler } =
    useDetachContext()

  // isLinking: when the tab expects to be linked soon (e.g. on detach)
  const [isLinking, setIsLinking] = useState(false)

  // isLinked: when the tab is linked to another tab (of different role)
  const [isLinked, setIsLinked] = useState(false)

  // isRedundant: when a second detacher tab is opened, the first becomes
  // redundant
  const [isRedundant, setIsRedundant] = useState(false)

  const uiTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (debugPdfDetach) {
      debugConsole.warn('Effect', { isLinked })
    }
    setIsLinking(false)
  }, [isLinked, setIsLinking])

  useEffect(() => {
    if (debugPdfDetach) {
      debugConsole.warn('Effect', { role, isLinked })
    }
    if (role === 'detached' && isLinked) {
      eventTracking.sendMB('project-layout-detached')
    }
  }, [role, isLinked])

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
      debugConsole.warn('Effect', { isLinking })
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
    setIsRedundant(false)
    setRole('detacher')
    setIsLinking(true)

    window.open(buildUrlWithDetachRole('detached').toString(), '_blank')
  }, [setRole, setIsLinking])

  const handleEventForDetacherFromDetacher = useCallback(() => {
    if (debugPdfDetach) {
      debugConsole.warn(
        'Duplicate detacher detected, turning into a regular editor again'
      )
    }
    setIsRedundant(true)
    setIsLinked(false)
    setRole(null)
  }, [setRole, setIsLinked])

  const handleEventForDetacherFromDetached = useCallback(
    (message: any) => {
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
    (message: any) => {
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

  const handleEventForDetachedFromDetached = useCallback(
    (message: any) => {
      switch (message.event) {
        case 'closed':
          broadcastEvent('up')
          break
      }
    },
    [broadcastEvent]
  )

  const handleEvent = useCallback(
    (message: any) => {
      if (role === 'detacher') {
        if (message.role === 'detacher') {
          handleEventForDetacherFromDetacher()
        } else if (message.role === 'detached') {
          handleEventForDetacherFromDetached(message)
        }
      } else if (role === 'detached') {
        if (message.role === 'detacher') {
          handleEventForDetachedFromDetacher(message)
        } else if (message.role === 'detached') {
          handleEventForDetachedFromDetached(message)
        }
      }
    },
    [
      role,
      handleEventForDetacherFromDetacher,
      handleEventForDetacherFromDetached,
      handleEventForDetachedFromDetacher,
      handleEventForDetachedFromDetached,
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
    isRedundant,
  }
}
