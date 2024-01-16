import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'

export default function populateReviewPanelScope(store: ReactScopeValueStore) {
  store.set('loadingThreads', true)
  store.set('users', {})
  store.set('addNewComment', () => {})
}
