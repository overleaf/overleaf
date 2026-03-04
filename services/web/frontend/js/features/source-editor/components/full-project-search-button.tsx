import { sendSearchEvent } from '@/features/event-tracking/search-events'
import OLButton from '@/shared/components/ol/ol-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { closeSearchPanel, SearchQuery } from '@codemirror/search'
import { useCallback } from 'react'
import { useCodeMirrorViewContext } from './codemirror-context'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { useRailContext } from '@/features/ide-react/context/rail-context'

export const FullProjectSearchButton = ({ query }: { query: SearchQuery }) => {
  const view = useCodeMirrorViewContext()
  const { t } = useTranslation()
  const { openTab } = useRailContext()

  const openFullProjectSearch = useCallback(() => {
    openTab('full-project-search')

    closeSearchPanel(view)
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('editor:full-project-search', { detail: query })
      )
    }, 200)
  }, [query, view, openTab])

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
        <OLButton variant="ghost" size="sm" onClick={onClick}>
          <MaterialIcon
            type="manage_search"
            accessibilityLabel={t('search_all_project_files')}
          />
        </OLButton>
      </OLTooltip>
    </>
  )
}
