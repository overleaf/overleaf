import { createContext, useCallback, useContext, useState } from 'react'

type CommandInvocationContext = {
  location?: string
}

export type Command = {
  label: string
  id: string
  handler?: (context: CommandInvocationContext) => void
  href?: string
  disabled?: boolean
  // TODO: Keybinding?
}

const CommandRegistryContext = createContext<CommandRegistry | undefined>(
  undefined
)

type CommandRegistry = {
  registry: Map<string, Command>
  register: (...elements: Command[]) => void
  unregister: (...id: string[]) => void
}

export const CommandRegistryProvider: React.FC = ({ children }) => {
  const [registry, setRegistry] = useState(new Map<string, Command>())
  const register = useCallback((...elements: Command[]) => {
    setRegistry(
      registry =>
        new Map([
          ...registry,
          ...elements.map(element => [element.id, element] as const),
        ])
    )
  }, [])

  const unregister = useCallback((...ids: string[]) => {
    setRegistry(
      registry => new Map([...registry].filter(([key]) => !ids.includes(key)))
    )
  }, [])

  return (
    <CommandRegistryContext.Provider value={{ registry, register, unregister }}>
      {children}
    </CommandRegistryContext.Provider>
  )
}

export const useCommandRegistry = (): CommandRegistry => {
  const context = useContext(CommandRegistryContext)
  if (!context) {
    throw new Error(
      'useCommandRegistry must be used within a CommandRegistryProvider'
    )
  }
  return context
}
