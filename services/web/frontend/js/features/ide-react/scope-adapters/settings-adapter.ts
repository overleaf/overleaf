import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'

export function populateSettingsScope(store: ReactScopeValueStore) {
  store.set('settings', window.userSettings)
}
