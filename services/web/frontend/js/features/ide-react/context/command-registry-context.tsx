import { isMac } from '@/shared/utils/os'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

type CommandInvocationContext = {
  location?: string
}

export type Command = {
  label: string
  id: string
  handler?: (context: CommandInvocationContext) => void
  href?: string
  disabled?: boolean
}

const CommandRegistryContext = createContext<CommandRegistry | undefined>(
  undefined
)

export type Shortcut = { key: string }

export type Shortcuts = Record<string, Shortcut[]>

type CommandRegistry = {
  registry: Map<string, Command>
  register: (...elements: Command[]) => void
  unregister: (...id: string[]) => void
  shortcuts: Shortcuts
}

export const CommandRegistryProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
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

  // NOTE: This is where we'd add functionality for customising shortcuts.
  const shortcuts: Record<string, Shortcut[]> = useMemo(
    () => ({
      cut: [{ key: 'Mod-x' }],
      copy: [{ key: 'Mod-c' }],
      paste: [{ key: 'Mod-v' }],
      'paste-special': [{ key: 'Mod-Shift-V' }],
      'toggle-track-changes': [{ key: 'Mod-Shift-A' }],
      undo: [
        {
          key: 'Mod-z',
        },
      ],
      redo: [
        {
          key: 'Mod-y',
        },
        {
          key: 'Mod-Shift-Z',
        },
      ],
      find: [{ key: 'Mod-f' }],
      'select-all': [{ key: 'Mod-a' }],
      'insert-comment': [{ key: 'Mod-Shift-C' }],
      'format-bold': [{ key: 'Mod-b' }],
      'format-italics': [{ key: 'Mod-i' }],
    }),
    []
  )

  return (
    <CommandRegistryContext.Provider
      value={{ registry, register, unregister, shortcuts }}
    >
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

function parseShortcut(shortcut: Shortcut) {
  // Based on KeyBinding type of CodeMirror 6
  let alt = false
  let ctrl = false
  let shift = false
  let meta = false

  let character = null
  // isMac ? shortcut.mac : shortcut.key etc.
  const shortcutString = shortcut.key ?? ''
  const keys = shortcutString.split(/-(?!$)/) ?? []

  for (let i = 0; i < keys.length; i++) {
    const isLast = i === keys.length - 1
    const key = keys[i]
    if (!key) {
      throw new Error('Empty key in shortcut: ' + shortcutString)
    }
    if (key === 'Alt' || (!isLast && key === 'a')) {
      alt = true
    } else if (
      key === 'Ctrl' ||
      key === 'Control' ||
      (!isLast && key === 'c')
    ) {
      ctrl = true
    } else if (key === 'Shift' || (!isLast && key === 's')) {
      shift = true
    } else if (key === 'Meta' || key === 'Cmd' || (!isLast && key === 'm')) {
      meta = true
    } else if (key === 'Mod') {
      if (isMac) {
        meta = true
      } else {
        ctrl = true
      }
    } else {
      if (key === 'Space') {
        character = ' '
      }
      if (!isLast) {
        throw new Error(
          'Character key must be last in shortcut: ' + shortcutString
        )
      }
      if (key.length !== 1) {
        throw new Error(`Invalid key '${key}' in shortcut: ${shortcutString}`)
      }
      if (character) {
        throw new Error('Multiple characters in shortcut: ' + shortcutString)
      }
      character = key
    }
  }
  if (!character) {
    throw new Error('No character in shortcut: ' + shortcutString)
  }

  return {
    alt,
    ctrl,
    shift,
    meta,
    character,
  }
}

export const formatShortcut = (shortcut: Shortcut): string => {
  const { alt, ctrl, shift, meta, character } = parseShortcut(shortcut)

  if (isMac) {
    return [
      ctrl ? '⌃' : '',
      alt ? '⌥' : '',
      shift ? '⇧' : '',
      meta ? '⌘' : '',
      character.toUpperCase(),
    ].join('')
  }

  return [
    ctrl ? 'Ctrl' : '',
    shift ? 'Shift' : '',
    meta ? 'Meta' : '',
    alt ? 'Alt' : '',
    character.toUpperCase(),
  ].join(' ')
}
