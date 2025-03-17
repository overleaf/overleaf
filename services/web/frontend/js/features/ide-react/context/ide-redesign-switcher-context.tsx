import {
  createContext,
  Dispatch,
  FC,
  SetStateAction,
  useContext,
  useState,
} from 'react'

type IdeRedesignSwitcherContextValue = {
  showSwitcherModal: boolean
  setShowSwitcherModal: Dispatch<SetStateAction<boolean>>
}

export const IdeRedesignSwitcherContext = createContext<
  IdeRedesignSwitcherContextValue | undefined
>(undefined)

export const IdeRedesignSwitcherProvider: FC = ({ children }) => {
  const [showSwitcherModal, setShowSwitcherModal] = useState(false)

  return (
    <IdeRedesignSwitcherContext.Provider
      value={{ showSwitcherModal, setShowSwitcherModal }}
    >
      {children}
    </IdeRedesignSwitcherContext.Provider>
  )
}

export const useIdeRedesignSwitcherContext = () => {
  const context = useContext(IdeRedesignSwitcherContext)
  if (!context) {
    throw new Error(
      'useIdeRedesignSwitcherContext is only available inside IdeRedesignSwitcherProvider'
    )
  }
  return context
}
