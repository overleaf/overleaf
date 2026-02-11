import getMeta from '@/utils/meta'
import {
  createContext,
  Dispatch,
  FC,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

export const TutorialContext = createContext<
  | {
      deactivateTutorial: (tutorial: string) => void
      inactiveTutorials: string[]
      currentPopup: string | null
      setCurrentPopup: Dispatch<SetStateAction<string | null>>
    }
  | undefined
>(undefined)

export const TutorialProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const [inactiveTutorials, setInactiveTutorials] = useState(
    () => getMeta('ol-inactiveTutorials') || []
  )

  const [currentPopup, setCurrentPopup] = useState<string | null>(null)

  const deactivateTutorial = useCallback(
    (tutorialKey: string) => {
      setInactiveTutorials([...inactiveTutorials, tutorialKey])
    },
    [inactiveTutorials]
  )

  const value = useMemo(
    () => ({
      deactivateTutorial,
      inactiveTutorials,
      currentPopup,
      setCurrentPopup,
    }),
    [deactivateTutorial, inactiveTutorials, currentPopup, setCurrentPopup]
  )

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorialContext() {
  const context = useContext(TutorialContext)

  if (!context) {
    throw new Error(
      'useTutorialContext is only available inside TutorialProvider'
    )
  }

  return context
}
