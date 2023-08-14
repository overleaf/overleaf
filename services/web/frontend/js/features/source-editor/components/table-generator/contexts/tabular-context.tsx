import { FC, RefObject, createContext, useContext, useRef } from 'react'

const TabularContext = createContext<
  { ref: RefObject<HTMLDivElement> } | undefined
>(undefined)

export const TabularProvider: FC = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <TabularContext.Provider value={{ ref }}>
      {children}
    </TabularContext.Provider>
  )
}

export const useTabularContext = () => {
  const tabularContext = useContext(TabularContext)
  if (!tabularContext) {
    throw new Error('TabularContext must be used within TabularProvider')
  }
  return tabularContext
}
