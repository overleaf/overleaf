import { useCallback, useMemo } from 'react'
import MiniSearch from 'minisearch'
import { CommandPaletteSearchResult, CommandPaletteSource } from '../types'
import {
  Command,
  useCommandRegistry,
} from '@/features/ide-react/context/command-registry-context'
import { useTranslation } from 'react-i18next'

type CommandGroup = {
  label: string
  actions: string[]
}

const useCommandRegistrySource = (): CommandPaletteSource => {
  const { t } = useTranslation()
  const elements: (CommandGroup | string)[] = useMemo(
    () => [
      {
        label: t('file'),
        actions: ['new_file', 'new_folder', 'upload_file'],
      },
      {
        label: t('view'),
        actions: [
          'change-layout-side-by-side',
          'change-layout-editor-only',
          'change-layout-pdf-only',
          'change-layout-detached-pdf',
          'change-layout-focus-mode',
        ],
      },
      {
        label: t('insert'),
        actions: [
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
        ],
      },
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
      'close-tab',
      'close-other-tabs',
    ],
    [t]
  )
  const { registry } = useCommandRegistry()

  const commands = useMemo(() => {
    const ret: Command[] = []
    for (const element of elements) {
      if (typeof element === 'string') {
        const command = registry.get(element)
        if (command && !command.disabled && command.handler) {
          ret.push(command)
        }
      } else {
        for (const action of element.actions) {
          const command = registry.get(action)
          if (command && !command.disabled && command.handler) {
            ret.push({
              ...command,
              label: `${element.label}: ${command.label}`,
            })
          }
        }
      }
    }
    return ret
  }, [registry, elements])

  const defaults = useCallback((): CommandPaletteSearchResult[] => {
    return commands.map(command => ({
      title: command.label,
      onSelect: () => command.handler!({ location: 'command-palette' }),
      score: 1,
      eventSegmentation: { source: 'command-registry', item: command.id },
    }))
  }, [commands])

  const index = useMemo(() => {
    const miniSearch = new MiniSearch<Command>({
      fields: ['label'],
      storeFields: ['id', 'label'],
      idField: 'id',
    })
    miniSearch.addAll(commands)
    return miniSearch
  }, [commands])

  return useMemo<CommandPaletteSource>(
    () => ({
      id: 'command-registry',
      prefix: '>',
      search(query) {
        const results = index.search(query, {
          prefix: true,
          fuzzy: term => (term.length > 3 ? 0.2 : false),
        })
        return results.flatMap(({ id, label, score }) => {
          const command = registry.get(id)
          if (!command?.handler) return []
          return [
            {
              title: label,
              onSelect: () => command.handler!({ location: 'command-palette' }),
              score,
              eventSegmentation: { source: 'command-registry', item: id },
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
