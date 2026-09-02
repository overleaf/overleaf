import { useEffect, useState } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { debugConsole } from '@/utils/debugging'
import { CommandDefinition } from '../utils/command-definitions/command-definition'
import { getCommandDefinitionIndexer } from '../utils/command-definitions/command-definition-indexer'
import { commandNameAtPos } from '../utils/command-definitions/command-name-at-pos'
import { useCodeMirrorStateContext } from '../components/codemirror-context'
import { contextMenuStateField } from '../extensions/context-menu'

/**
 * Look up where `name` is defined in the project, by parsing the snapshot in a
 * worker. Intended to be used while the editor context menu is open: the lookup
 * runs off the main thread, so opening the menu is never blocked, and the item
 * is disabled until the worker responds.
 *
 * Pass `name` null when the menu was not opened on a command, to avoid
 * refreshing the snapshot (a project-history flush) and parsing on every
 * right-click. `lookupKey` should change on each open (e.g. the tooltip object)
 * so the lookup reruns even if the menu component stays mounted across reopens.
 */
function useCommandDefinition(name: string | null, lookupKey: unknown) {
  const { projectSnapshot } = useProjectContext()

  const [definition, setDefinition] = useState<CommandDefinition | null>(null)

  useEffect(() => {
    // Reset while the new lookup runs so a stale definition isn't shown.
    setDefinition(null)
    if (!name) {
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        await projectSnapshot.refresh()
        if (cancelled) {
          return
        }
        const found = await getCommandDefinitionIndexer().findDefinition(
          projectSnapshot,
          name
        )
        if (!cancelled) {
          setDefinition(found)
        }
      } catch (error) {
        debugConsole.error('Failed to find command definition', error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectSnapshot, name, lookupKey])

  return definition
}

/**
 * Resolve the command the editor context menu was opened on and its project-wide
 * definition (if any). Returns nulls when the menu was not opened on a command;
 * the lookup only runs when the menu was opened on a command.
 */
export function useContextMenuCommandDefinition() {
  const state = useCodeMirrorStateContext()
  // The tooltip is a new object on each open, so use it as the lookup key.
  const tooltip = state.field(contextMenuStateField, false)?.tooltip ?? null
  const pos = tooltip?.pos ?? null
  const commandName = pos != null ? commandNameAtPos(state, pos) : null
  const commandDefinition = useCommandDefinition(commandName, tooltip)
  return { commandName, commandDefinition }
}
