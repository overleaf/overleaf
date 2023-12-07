import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'

export default function populateReviewPanelScope(store: ReactScopeValueStore) {
  store.set('reviewPanel.overview.loading', false)
  store.set('reviewPanel.nVisibleSelectedChanges', 0)
  store.set('users', {})
  store.set('reviewPanel.layoutToLeft', false)
  store.set('gotoEntry', () => {})
  store.set('addNewComment', () => {})
}
