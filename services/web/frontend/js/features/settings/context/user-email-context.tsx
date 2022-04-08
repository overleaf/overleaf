import { createContext, useContext, useReducer, useCallback } from 'react'
import getMeta from '../../../utils/meta'
import useSafeDispatch from '../../../shared/hooks/use-safe-dispatch'
import { UserEmailData } from '../../../../../types/user-email'
import { normalize, NormalizedObject } from '../../../utils/normalize'

// eslint-disable-next-line no-unused-vars
enum Actions {
  SET_LOADING_STATE = 'SET_LOADING_STATE', // eslint-disable-line no-unused-vars
}

type ActionSetLoading = {
  type: Actions.SET_LOADING_STATE
  payload: boolean
}

type State = {
  isLoading: boolean
  data: {
    byId: NormalizedObject<UserEmailData>
  }
}

type Action = ActionSetLoading

const setLoadingAction = (state: State, action: ActionSetLoading) => ({
  ...state,
  isLoading: action.payload,
})

const initialState: State = {
  isLoading: false,
  data: {
    byId: {},
  },
}

const reducer = (state: State, action: Action) => {
  switch (action.type) {
    case Actions.SET_LOADING_STATE:
      return setLoadingAction(state, action)
  }
}

const initializer = (initialState: State) => {
  const normalized = normalize<UserEmailData>(getMeta('ol-userEmails'), {
    idAttribute: 'email',
  })
  const byId = normalized || {}

  return {
    ...initialState,
    data: {
      ...initialState.data,
      byId,
    },
  }
}

function useUserEmails() {
  const [state, dispatch] = useReducer(reducer, initialState, initializer)
  const safeDispatch = useSafeDispatch(dispatch)

  const setLoading = useCallback(
    (flag: boolean) => {
      safeDispatch({
        type: Actions.SET_LOADING_STATE,
        payload: flag,
      })
    },
    [safeDispatch]
  )

  return {
    state,
    setLoading,
  }
}

const UserEmailsContext = createContext<
  ReturnType<typeof useUserEmails> | undefined
>(undefined)
UserEmailsContext.displayName = 'UserEmailsContext'

type UserEmailsProviderProps = {
  children: React.ReactNode
} & Record<string, unknown>

function UserEmailsProvider(props: UserEmailsProviderProps) {
  const value = useUserEmails()

  return <UserEmailsContext.Provider value={value} {...props} />
}

const useUserEmailsContext = () => {
  const context = useContext(UserEmailsContext)

  if (context === undefined) {
    throw new Error('useUserEmailsContext must be used in a UserEmailsProvider')
  }

  return context
}

export { UserEmailsProvider, useUserEmailsContext }
