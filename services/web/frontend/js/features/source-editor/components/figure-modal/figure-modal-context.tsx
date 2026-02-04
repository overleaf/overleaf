import { FC, createContext, useContext, useReducer } from 'react'
import { PastedImageData } from '../../utils/paste-image'

/* eslint-disable no-unused-vars */
export enum FigureModalSource {
  NONE,
  FILE_UPLOAD,
  FILE_TREE,
  FROM_URL,
  OTHER_PROJECT,
  EDIT_FIGURE,
}
/* eslint-enable no-unused-vars */

type FigureModalState = {
  source: FigureModalSource
  helpShown: boolean
  sourcePickerShown: boolean
  getPath?: () => Promise<string>
  width: number | undefined
  includeCaption: boolean
  includeLabel: boolean
  error?: string
  pastedImageData?: PastedImageData
  selectedItemId?: string
}

type FigureModalStateUpdate = Partial<FigureModalState>

const FigureModalContext = createContext<
  | (FigureModalState & {
      dispatch: (update: FigureModalStateUpdate) => void
    })
  | undefined
>(undefined)

export const useFigureModalContext = () => {
  const context = useContext(FigureModalContext)

  if (!context) {
    throw new Error(
      'useFigureModalContext is only available inside FigureModalProvider'
    )
  }

  return context
}

const reducer = (prev: FigureModalState, action: Partial<FigureModalState>) => {
  if ('source' in action && prev.source === FigureModalSource.NONE) {
    // Reset when showing modal
    return {
      ...prev,
      width: 0.5,
      includeLabel: true,
      includeCaption: true,
      helpShown: false,
      sourcePickerShown: false,
      getPath: undefined,
      error: undefined,
      pastedImageData: undefined,
      ...action,
    }
  }
  return { ...prev, ...action }
}

type FigureModalExistingFigureState = {
  name: string | undefined
  hasComplexGraphicsArgument?: boolean
}

type FigureModalExistingFigureStateUpdate =
  Partial<FigureModalExistingFigureState>

const FigureModalExistingFigureContext = createContext<
  | (FigureModalExistingFigureState & {
      dispatch: (update: FigureModalExistingFigureStateUpdate) => void
    })
  | undefined
>(undefined)

export const FigureModalProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(reducer, {
    source: FigureModalSource.NONE,
    helpShown: false,
    sourcePickerShown: false,
    getPath: undefined,
    includeLabel: true,
    includeCaption: true,
    width: 0.5,
  })

  const [existingFigureState, dispatchFigureState] = useReducer(
    (
      prev: FigureModalExistingFigureState,
      action: FigureModalExistingFigureStateUpdate
    ) => ({ ...prev, ...action }),
    {
      name: undefined,
    }
  )

  return (
    <FigureModalContext.Provider value={{ ...state, dispatch }}>
      <FigureModalExistingFigureContext.Provider
        value={{ ...existingFigureState, dispatch: dispatchFigureState }}
      >
        {children}
      </FigureModalExistingFigureContext.Provider>
    </FigureModalContext.Provider>
  )
}

export const useFigureModalExistingFigureContext = () => {
  const context = useContext(FigureModalExistingFigureContext)

  if (!context) {
    throw new Error(
      'useFigureModalExistingFigureContext is only available inside FigureModalProvider'
    )
  }

  return context
}
