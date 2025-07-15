import { EditorView } from '@codemirror/view'

const breadcrumbsTheme = EditorView.baseTheme({
  '.ol-cm-breadcrumbs-portal': {
    display: 'flex',
    pointerEvents: 'none !important',
    '& > *': {
      pointerEvents: 'all',
    },
  },
  '.ol-cm-breadcrumbs': {
    height: 'var(--breadcrumbs-height)',
    flex: 1,
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
  '&light .ol-cm-breadcrumb-chevron': {
    color: 'var(--neutral-30)',
  },
  '&dark .ol-cm-breadcrumb-chevron': {
    color: 'var(--neutral-50)',
  },
})

/**
 * A panel which contains the editor breadcrumbs
 */
export function breadcrumbPanel() {
  return [
    EditorView.editorAttributes.of({
      style: '--breadcrumbs-height: 28px;',
    }),
    breadcrumbsTheme,
  ]
}
