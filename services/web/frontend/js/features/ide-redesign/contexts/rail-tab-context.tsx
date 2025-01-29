import {
  createContext,
  Dispatch,
  FC,
  SetStateAction,
  useContext,
  useMemo,
  useState,
} from 'react'

export type RailTabKey =
  | 'file-tree'
  | 'integrations'
  | 'review-panel'
  | 'chat'
  | 'errors'

const RailTabContext = createContext<
  | {
      selectedTab: RailTabKey
      setSelectedTab: Dispatch<SetStateAction<RailTabKey>>
    }
  | undefined
>(undefined)

export const RailTabProvider: FC = ({ children }) => {
  // NOTE: The file tree **MUST** be the first tab to be opened
  //       since it is responsible for opening the initial document.
  const [selectedTab, setSelectedTab] = useState<RailTabKey>('file-tree')

  const value = useMemo(
    () => ({
      selectedTab,
      setSelectedTab,
    }),
    [selectedTab, setSelectedTab]
  )

  return (
    <RailTabContext.Provider value={value}>{children}</RailTabContext.Provider>
  )
}

export const useRailTabContext = () => {
  const context = useContext(RailTabContext)
  if (!context) {
    throw new Error(
      'useRailTabContext is only available inside RailTabProvider'
    )
  }
  return context
}
