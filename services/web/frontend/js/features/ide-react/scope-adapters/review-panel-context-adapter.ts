import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'

export default function populateReviewPanelScope(store: ReactScopeValueStore) {
  store.set('users', {})
  store.set('reviewPanel.layoutToLeft', false)
  store.set('gotoEntry', () => {})
  store.set('addNewComment', () => {})
}
