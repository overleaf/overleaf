import { ReactScopeValueStore } from '../scope-value-store/react-scope-value-store'
import getMeta from '@/utils/meta'

const reviewPanelStorageKey = `ui.reviewPanelOpen.${getMeta('ol-project_id')}`

export default function populateLayoutScope(store: ReactScopeValueStore) {
  store.set('ui.view', 'editor')
  store.set('openFile', null)
  store.persisted('ui.chatOpen', false, 'ui.chatOpen')
  store.persisted('ui.reviewPanelOpen', false, reviewPanelStorageKey)
  store.set('ui.leftMenuShown', false)
  store.set('ui.miniReviewPanelVisible', false)
  store.set('ui.pdfLayout', 'sideBySide')
}
