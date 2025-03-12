import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { EditorView, showPanel } from '@codemirror/view'

export function createBreadcrumbsPanel() {
  const dom = document.createElement('div')
  dom.classList.add('ol-cm-breadcrumbs-portal')
  return { dom, top: true }
}

const breadcrumbsTheme = EditorView.baseTheme({
  '.ol-cm-breadcrumbs': {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-01)',
    fontSize: 'var(--font-size-01)',
    padding: 'var(--spacing-02)',
    overflow: 'auto',
    scrollbarWidth: 'thin',
    '& > *': {
      flexShrink: '0',
    },
  },
  '&light .ol-cm-breadcrumbs': {
    color: 'var(--content-secondary)',
    backgroundColor: 'var(--bg-light-primary)',
    borderBottom: '1px solid #ddd',
  },
  '&light .ol-cm-breadcrumb-chevron': {
    color: 'var(--neutral-30)',
  },
  '&dark .ol-cm-breadcrumbs': {
    color: 'var(--content-secondary-dark)',
    backgroundColor: 'var(--bg-dark-primary)',
  },
  '&dark .ol-cm-breadcrumb-chevron': {
    color: 'var(--neutral-50)',
  },
})

/**
 * A panel which contains the editor breadcrumbs
 */
export const breadcrumbPanel = () => {
  if (!isSplitTestEnabled('editor-redesign')) {
    return []
  }

  return [showPanel.of(createBreadcrumbsPanel), breadcrumbsTheme]
}
