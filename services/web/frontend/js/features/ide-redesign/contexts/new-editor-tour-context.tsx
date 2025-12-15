import { useLayoutContext } from '@/shared/context/layout-context'
import {
  createContext,
  FC,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

export type NewEditorTourStage = 'rail' | 'logs' | 'theme' | 'switch-back'

const NewEditorTourContext = createContext<
  | {
      stage: NewEditorTourStage
      stageNumber: number
      totalStages: number
      isShowing: boolean
      shouldShowTourStage: (tourStage: NewEditorTourStage) => boolean
      startTour: () => void
      goToNextStage: () => void
      finishTour: () => void
      dismissTour: () => void
    }
  | undefined
>(undefined)

const STAGES: NewEditorTourStage[] = ['rail', 'logs', 'theme', 'switch-back']
const EDITOR_ONLY_STAGES: NewEditorTourStage[] = [
  'rail',
  'theme',
  'switch-back',
]

export const NewEditorTourProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [stage, setStage] = useState<NewEditorTourStage>('rail')
  const [showTour, setShowTour] = useState(false)
  const { view, pdfLayout } = useLayoutContext()
  const pdfIsOpen = pdfLayout === 'sideBySide' || view === 'pdf'

  const stagesToShow = useMemo(
    () => (pdfIsOpen ? STAGES : EDITOR_ONLY_STAGES),
    [pdfIsOpen]
  )

  const startTour = useCallback(() => {
    setShowTour(true)
  }, [])

  const stageNumber = useMemo(
    () => stagesToShow.indexOf(stage) + 1,
    [stage, stagesToShow]
  )
  const totalStages = stagesToShow.length

  const goToNextStage = useCallback(() => {
    setStage(stagesToShow[stageNumber])
  }, [stageNumber, stagesToShow])

  const dismissTour = useCallback(() => {
    setShowTour(false)
  }, [])

  const finishTour = useCallback(() => {
    setShowTour(false)
  }, [])

  const shouldShowTourStage = useCallback(
    (tourStage: NewEditorTourStage) => {
      return showTour && stage === tourStage
    },
    [showTour, stage]
  )

  const value = useMemo(
    () => ({
      stage,
      stageNumber,
      totalStages,
      shouldShowTourStage,
      startTour,
      goToNextStage,
      finishTour,
      dismissTour,
      isShowing: showTour,
    }),
    [
      stage,
      stageNumber,
      totalStages,
      shouldShowTourStage,
      startTour,
      goToNextStage,
      finishTour,
      dismissTour,
      showTour,
    ]
  )

  return (
    <NewEditorTourContext.Provider value={value}>
      {children}
    </NewEditorTourContext.Provider>
  )
}

export const useNewEditorTourContext = () => {
  const context = useContext(NewEditorTourContext)
  if (!context) {
    throw new Error(
      'useNewEditorTourContext is only available inside RailProvider'
    )
  }
  return context
}
