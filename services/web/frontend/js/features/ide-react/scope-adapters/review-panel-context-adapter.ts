import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'

export default function populateReviewPanelScope(store: ReactScopeValueStore) {
  store.set('reviewPanel.overview.docsCollapsedState', {})
  store.set('reviewPanel.subView', 'cur_file')
  store.set('reviewPanel.overview.loading', false)
  store.set('reviewPanel.nVisibleSelectedChanges', 0)
  store.set('reviewPanel.commentThreads', {})
  store.set('reviewPanel.entries', {})
  store.set('loadingThreads', true)
  store.set('permissions', {
    read: false,
    write: false,
    admin: false,
    comment: false,
  })
  store.set('users', {})
  store.set('reviewPanel.resolvedComments', {})
  store.set('reviewPanel.rendererData.lineHeight', 0)
  store.set('resolveComment', () => {})
  store.set('submitNewComment', async () => {})
  store.set('deleteComment', () => {})
  store.set('gotoEntry', () => {})
  store.set('saveEdit', () => {})
  store.set('unresolveComment', () => {})
  store.set('deleteThread', () => {})
  store.set('refreshResolvedCommentsDropdown', async () => {})
  store.set('acceptChanges', () => {})
  store.set('rejectChanges', () => {})
  store.set('bulkAcceptActions', () => {})
  store.set('bulkRejectActions', () => {})
  store.set('submitReply', () => {})
  store.set('addNewComment', () => {})
}
