import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import {
  createContext,
  FC,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

export type View = 'cur_file' | 'overview'

export const ReviewPanelViewContext = createContext<View>('cur_file')

type ViewActions = {
  setView: (newView: View) => void
}

const ReviewPanelViewActionsContext = createContext<ViewActions | undefined>(
  undefined
)

export const ReviewPanelViewProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [view, setView] = useState<View>('cur_file')
  const { sendEvent } = useEditorAnalytics()

  const handleSetView = useCallback(
    (newView: View) => {
      sendEvent('rp-subview-change', { subView: newView })
      setView(newView)
    },
    [sendEvent]
  )

  const actions = useMemo(
    () => ({
      setView: handleSetView,
    }),
    [handleSetView]
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
