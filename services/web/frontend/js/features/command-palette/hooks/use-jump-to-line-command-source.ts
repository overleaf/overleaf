import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { CommandPaletteSource } from '../types'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const JUMP_REGEX = /^(\d+)(?:,(\d+))?$/

export const useJumpToLineCommandSource = (): CommandPaletteSource => {
  const { jumpToLine } = useEditorManagerContext()
  const { t } = useTranslation()
  return useMemo(
    () => ({
      id: 'jump-to-line-source',
      prefix: ':',
      prefixRequired: true,
      search: (query: string) => {
        const match = query.match(JUMP_REGEX)
        if (!match) {
          return []
        }
        const line = parseInt(match[1], 10)
        const column = match[2] ? parseInt(match[2], 10) : undefined

        return [
          {
            onSelect: () => jumpToLine({ gotoLine: line, gotoColumn: column }),
            title:
              column != null
                ? t('jump_to_line_x_column_y', {
                    line,
                    column,
                  })
                : t('jump_to_line_x', {
                    line,
                  }),
            score: 1,
            eventSegmentation: { source: 'jump-to-line' },
          },
        ]
      },
    }),
    [jumpToLine, t]
  )
}
