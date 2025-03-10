import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { showPanel } from '@codemirror/view'

export function createBreadcrumbsPanel() {
  const dom = document.createElement('div')
  dom.classList.add('ol-cm-breadcrumbs-portal')
  return { dom, top: true }
}

/**
 * A panel which contains the editor breadcrumbs
 */
export const breadcrumbPanel = () => {
  if (!isSplitTestEnabled('editor-redesign')) {
    return []
  }

  return [showPanel.of(createBreadcrumbsPanel)]
}
