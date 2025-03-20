import { canUseNewEditor } from '@/features/ide-redesign/utils/new-editor-utils'
import { Compartment, Extension, TransactionSpec } from '@codemirror/state'
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

const breadcrumbsConf = new Compartment()

const breadcrumbsEnabled: Extension = [
  showPanel.of(createBreadcrumbsPanel),
  breadcrumbsTheme,
]
const breadcrumbsDisabled: Extension = []

export const setBreadcrumbsEnabled = (enabled: boolean): TransactionSpec => ({
  effects: breadcrumbsConf.reconfigure(
    enabled ? breadcrumbsEnabled : breadcrumbsDisabled
  ),
})

/**
 * A panel which contains the editor breadcrumbs
 */
export const breadcrumbPanel = (enableNewEditor: boolean) => {
  const enabled = canUseNewEditor() && enableNewEditor
  return breadcrumbsConf.of(enabled ? breadcrumbsEnabled : breadcrumbsDisabled)
}
