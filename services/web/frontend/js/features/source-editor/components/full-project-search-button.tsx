import { sendSearchEvent } from '@/features/event-tracking/search-events'
import OLButton from '@/shared/components/ol/ol-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { useLayoutContext } from '@/shared/context/layout-context'
import { closeSearchPanel, SearchQuery } from '@codemirror/search'
import { useCallback } from 'react'
import { useCodeMirrorViewContext } from './codemirror-context'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import { useRailContext } from '@/features/ide-redesign/contexts/rail-context'

export const FullProjectSearchButton = ({ query }: { query: SearchQuery }) => {
  const view = useCodeMirrorViewContext()
  const { t } = useTranslation()
  const { setProjectSearchIsOpen } = useLayoutContext()
  const newEditor = useIsNewEditorEnabled()
  const { openTab } = useRailContext()

  const openFullProjectSearch = useCallback(() => {
    if (newEditor) {
      openTab('full-project-search')
    } else {
      setProjectSearchIsOpen(true)
    }
    closeSearchPanel(view)
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('editor:full-project-search', { detail: query })
      )
    }, 200)
  }, [setProjectSearchIsOpen, query, view, newEditor, openTab])

  const onClick = useCallback(() => {
    sendSearchEvent('search-open', {
      searchType: 'full-project',
      method: 'button',
      location: 'search-form',
    })
    openFullProjectSearch()
  }, [openFullProjectSearch])

  return (
    <>
      <OLTooltip
        id="open-full-project-search"
        overlayProps={{ placement: 'top' }}
        description={t('search_all_project_files')}
      >
        <OLButton variant="secondary" size="sm" onClick={onClick}>
          <MaterialIcon
            type="manage_search"
            accessibilityLabel={t('search_all_project_files')}
          />
        </OLButton>
      </OLTooltip>
    </>
  )
}
