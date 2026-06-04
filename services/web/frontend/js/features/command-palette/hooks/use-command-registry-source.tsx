import { useCallback, useMemo } from 'react'
import MiniSearch from 'minisearch'
import { CommandPaletteSearchResult, CommandPaletteSource } from '../types'
import {
  Command,
  useCommandRegistry,
} from '@/features/ide-react/context/command-registry-context'

const ENABLED_COMMANDS: string[] = [
  'new_file',
  'new_folder',
  'upload_file',
  'open-settings',
  'show_version_history',
  'word_count',
  'view-pdf-presentation-mode',
  'comment',
  'compile',
  'stop-compile',
  'recompile-from-scratch',
  'synctex-sync-to-pdf',
  'synctex-sync-to-code',
  'insert-inline-math',
  'insert-display-math',
  'insert-figure-from-computer',
  'insert-figure-from-project-files',
  'insert-figure-from-another-project',
  'insert-figure-from-url',
  'insert-table',
  'insert-citation',
  'insert-link',
  'insert-cross-reference',
]

const useCommandRegistrySource = (): CommandPaletteSource => {
  const { registry } = useCommandRegistry()

  const commands = useMemo(() => {
    const enabled = new Set(ENABLED_COMMANDS)
    return [...registry.values()].filter(
      c => enabled.has(c.id) && !c.disabled && c.handler
    )
  }, [registry])

  const defaults = useCallback((): CommandPaletteSearchResult[] => {
    return commands.map(command => ({
      title: command.label,
      onSelect: () => command.handler!({ location: 'command-palette' }),
      score: 1,
    }))
  }, [commands])

  const index = useMemo(() => {
    const miniSearch = new MiniSearch<Command>({
      fields: ['label'],
      storeFields: ['id'],
      idField: 'id',
    })
    miniSearch.addAll(commands)
    return miniSearch
  }, [commands])

  return useMemo<CommandPaletteSource>(
    () => ({
      id: 'command-registry',
      search(query) {
        const results = index.search(query, {
          prefix: true,
          fuzzy: term => (term.length > 3 ? 0.2 : false),
        })
        return results.flatMap(({ id, score }) => {
          const command = registry.get(id)
          if (!command?.handler) return []
          return [
            {
              title: command.label,
              onSelect: () => command.handler!({ location: 'command-palette' }),
              score,
            },
          ]
        })
      },
      defaults,
    }),
    [index, registry, defaults]
  )
}

export default useCommandRegistrySource
