import {
  createContext,
  Dispatch,
  FC,
  SetStateAction,
  useContext,
  useMemo,
  useState,
} from 'react'

export type View = 'cur_file' | 'overview'

export const ReviewPanelViewContext = createContext<View>('cur_file')

type ViewActions = {
  setView: Dispatch<SetStateAction<View>>
}

const ReviewPanelViewActionsContext = createContext<ViewActions | undefined>(
  undefined
)

export const ReviewPanelViewProvider: FC = ({ children }) => {
  const [view, setView] = useState<View>('cur_file')

  const actions = useMemo(
    () => ({
      setView,
    }),
    [setView]
  )

  return (
    <ReviewPanelViewActionsContext.Provider value={actions}>
      <ReviewPanelViewContext.Provider value={view}>
        {children}
      </ReviewPanelViewContext.Provider>
    </ReviewPanelViewActionsContext.Provider>
  )
}

export const useReviewPanelViewContext = () => {
  return useContext(ReviewPanelViewContext)
}

export const useReviewPanelViewActionsContext = () => {
  const context = useContext(ReviewPanelViewActionsContext)
  if (!context) {
    throw new Error(
      'useViewActionsContext is only available inside ViewProvider'
    )
  }
  return context
}
