import { ReactScopeValueStore } from '../scope-value-store/react-scope-value-store'
import getMeta from '@/utils/meta'

const reviewPanelStorageKey = `ui.reviewPanelOpen.${getMeta('ol-project_id')}`

export default function populateLayoutScope(store: ReactScopeValueStore) {
  store.set('ui.view', 'editor')

  // TODO: Find out what this needs to do and make it do it
  store.set('toggleHistory', () => {})

  store.set('openFile', null)
  store.set('ui.chatOpen', false)
  store.persisted('ui.reviewPanelOpen', false, reviewPanelStorageKey)
  store.set('ui.leftMenuShown', false)
  store.set('ui.pdfLayout', 'sideBySide')
  store.set('ui.loadingStyleSheet', false)
}
