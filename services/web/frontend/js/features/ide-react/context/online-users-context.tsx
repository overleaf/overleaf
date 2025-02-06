import {
  createContext,
  useContext,
  useEffect,
  FC,
  useCallback,
  useMemo,
  useState,
} from 'react'
import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import useScopeValue from '@/shared/hooks/use-scope-value'
import { CursorPosition } from '@/features/ide-react/types/cursor-position'
import { omit } from 'lodash'
import { Doc } from '../../../../../types/doc'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { findDocEntityById } from '@/features/ide-react/util/find-doc-entity-by-id'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import { debugConsole } from '@/utils/debugging'
import { IdeEvents } from '@/features/ide-react/create-ide-event-emitter'
import { getHueForUserId } from '@/shared/utils/colors'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'

export type OnlineUser = {
  id: string
  user_id: string
  email: string
  name: string
  initial?: string
  doc_id?: string
  doc?: Doc | null
  row?: number
  column?: number
}

type ConnectedUser = {
  client_id: string
  user_id: string
  email: string
  first_name: string
  last_name: string
  cursorData?: {
    doc_id: string
    row: number
    column: number
  }
}

type CursorHighlight = {
  label: string
  cursor: {
    row: number
    column: number
  }
  hue: number
}

type OnlineUsersContextValue = {
  onlineUsers: Record<string, OnlineUser>
  onlineUserCursorHighlights: Record<string, CursorHighlight[]>
  onlineUsersArray: OnlineUser[]
  onlineUsersCount: number
}

export function populateOnlineUsersScope(store: ReactScopeValueStore) {
  store.set('onlineUsers', {})
  store.set('onlineUserCursorHighlights', {})
  store.set('onlineUsersArray', [])
  store.set('onlineUsersCount', 0)
}

const OnlineUsersContext = createContext<OnlineUsersContextValue | undefined>(
  undefined
)

export const OnlineUsersProvider: FC = ({ children }) => {
  const { eventEmitter } = useIdeReactContext()
  const { socket } = useConnectionContext()
  const { currentDocumentId } = useEditorManagerContext()
  const { fileTreeData } = useFileTreeData()

  const [onlineUsers, setOnlineUsers] =
    useScopeValue<OnlineUsersContextValue['onlineUsers']>('onlineUsers')
  const [onlineUserCursorHighlights, setOnlineUserCursorHighlights] =
    useScopeValue<OnlineUsersContextValue['onlineUserCursorHighlights']>(
      'onlineUserCursorHighlights'
    )
  const [onlineUsersArray, setOnlineUsersArray] =
    useScopeValue<OnlineUsersContextValue['onlineUsersArray']>(
      'onlineUsersArray'
    )
  const [onlineUsersCount, setOnlineUsersCount] =
    useScopeValue<OnlineUsersContextValue['onlineUsersCount']>(
      'onlineUsersCount'
    )

  const [currentPosition, setCurrentPosition] = useState<CursorPosition | null>(
    null
  )
  const [cursorUpdateInterval, setCursorUpdateInterval] = useState(500)

  const calculateValues = useCallback(
    (onlineUsers: OnlineUsersContextValue['onlineUsers']) => {
      const decoratedOnlineUsers: OnlineUsersContextValue['onlineUsers'] = {}
      const onlineUsersArray: OnlineUser[] = []
      const onlineUserCursorHighlights: OnlineUsersContextValue['onlineUserCursorHighlights'] =
        {}

      for (const [clientId, user] of Object.entries(onlineUsers)) {
        const decoratedUser = { ...user }
        const docId = user.doc_id
        if (docId) {
          decoratedUser.doc = findDocEntityById(fileTreeData, docId)
        }

        // If the user's name is empty use their email as display name
        // Otherwise they're probably an anonymous user
        if (user.name === null || user.name.trim().length === 0) {
          decoratedUser.name = user.email ? user.email.trim() : 'Anonymous'
        }

        decoratedUser.initial = user.name?.[0]
        if (!decoratedUser.initial || decoratedUser.initial === ' ') {
          decoratedUser.initial = '?'
        }

        onlineUsersArray.push(decoratedUser)
        decoratedOnlineUsers[clientId] = decoratedUser

        if (docId == null || user.row == null || user.column == null) {
          continue
        }
        if (!onlineUserCursorHighlights[docId]) {
          onlineUserCursorHighlights[docId] = []
        }
        onlineUserCursorHighlights[docId].push({
          label: user.name,
          cursor: {
            row: user.row,
            column: user.column,
          },
          hue: getHueForUserId(user.user_id),
        })
      }

      const cursorUpdateInterval =
        onlineUsersArray.length > 0 ? 500 : 60 * 1000 * 5

      return {
        onlineUsers: decoratedOnlineUsers,
        onlineUsersArray,
        onlineUserCursorHighlights,
        cursorUpdateInterval,
      }
    },
    [fileTreeData]
  )

  const setAllValues = useCallback(
    (newOnlineUsers: OnlineUsersContextValue['onlineUsers']) => {
      const values = calculateValues(newOnlineUsers)
      setOnlineUsers(values.onlineUsers)
      setOnlineUsersArray(values.onlineUsersArray)
      setOnlineUsersCount(values.onlineUsersArray.length)
      setOnlineUserCursorHighlights(values.onlineUserCursorHighlights)
      setCursorUpdateInterval(values.cursorUpdateInterval)
    },
    [
      calculateValues,
      setOnlineUserCursorHighlights,
      setOnlineUsers,
      setOnlineUsersArray,
      setOnlineUsersCount,
    ]
  )

  useEffect(() => {
    const handleProjectJoined = () => {
      socket.emit(
        'clientTracking.getConnectedUsers',
        (error: Error, connectedUsers: ConnectedUser[]) => {
          if (error) {
            // TODO: handle this error or ignore it?
            debugConsole.error(error)
            return
          }
          const newOnlineUsers: OnlineUsersContextValue['onlineUsers'] = {}
          for (const user of connectedUsers) {
            if (user.client_id === socket.publicId) {
              // Don't store myself
              continue
            }
            // Store data in the same format returned by clientTracking.clientUpdated
            newOnlineUsers[user.client_id] = {
              id: user.client_id,
              user_id: user.user_id,
              email: user.email,
              name: `${user.first_name} ${user.last_name}`,
              doc_id: user.cursorData?.doc_id,
              row: user.cursorData?.row,
              column: user.cursorData?.column,
            }
          }
          setAllValues(newOnlineUsers)
        }
      )
    }
    eventEmitter.on('project:joined', handleProjectJoined)

    return () => {
      eventEmitter.off('project:joined', handleProjectJoined)
    }
  }, [eventEmitter, setAllValues, setOnlineUsers, socket])

  // Track the position of the main cursor
  useEffect(() => {
    const handleCursorUpdate = ({
      detail: [position],
    }: CustomEvent<IdeEvents['cursor:editor:update']>) => {
      if (position) {
        setCurrentPosition(position)
      }
    }

    eventEmitter.on('cursor:editor:update', handleCursorUpdate)

    return () => {
      eventEmitter.off('cursor:editor:update', handleCursorUpdate)
    }
  }, [cursorUpdateInterval, eventEmitter])

  // Send the latest position to other clients when currentPosition changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      socket.emit('clientTracking.updatePosition', {
        row: currentPosition?.row,
        column: currentPosition?.column,
        doc_id: currentDocumentId,
      })
    }, cursorUpdateInterval)

    return () => {
      window.clearTimeout(timer)
    }
  }, [currentPosition, cursorUpdateInterval, currentDocumentId, socket])

  const handleClientUpdated = useCallback(
    (client: OnlineUser) => {
      // Check it's not me!
      if (client.id !== socket.publicId) {
        setAllValues({ ...onlineUsers, [client.id]: client })
      }
    },
    [onlineUsers, setAllValues, socket.publicId]
  )

  useSocketListener(socket, 'clientTracking.clientUpdated', handleClientUpdated)

  const handleClientDisconnected = useCallback(
    (clientId: string) => {
      setAllValues(omit(onlineUsers, clientId))
    },
    [onlineUsers, setAllValues]
  )

  useSocketListener(
    socket,
    'clientTracking.clientDisconnected',
    handleClientDisconnected
  )

  const value = useMemo<OnlineUsersContextValue>(
    () => ({
      onlineUsers,
      onlineUsersArray,
      onlineUserCursorHighlights,
      onlineUsersCount,
    }),
    [
      onlineUsers,
      onlineUsersArray,
      onlineUserCursorHighlights,
      onlineUsersCount,
    ]
  )

  return (
    <OnlineUsersContext.Provider value={value}>
      {children}
    </OnlineUsersContext.Provider>
  )
}

export function useOnlineUsersContext(): OnlineUsersContextValue {
  const context = useContext(OnlineUsersContext)

  if (!context) {
    throw new Error(
      'useOnlineUsersContext is only available inside OnlineUsersProvider'
    )
  }

  return context
}
