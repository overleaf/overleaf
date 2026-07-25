import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { Compartment, Transaction, TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export const TAB_USER_EDIT_EVENT = 'tab-user-edit'

export const tabsEvents = new EventTarget()

const tabsListenerCompartment = new Compartment()

const updateListener = EditorView.updateListener.of(update => {
  if (!update.docChanged) return
  for (const transaction of update.transactions) {
    if (!transaction.annotation(Transaction.remote)) {
      tabsEvents.dispatchEvent(new Event(TAB_USER_EDIT_EVENT))
      return
    }
  }
})

export const tabsListener = (enabled: boolean) => {
  return tabsListenerCompartment.of(
    enabled && isSplitTestEnabled('editor-tabs') ? updateListener : []
  )
}

export const setEditorTabs = (enabled: boolean): TransactionSpec => ({
  effects: tabsListenerCompartment.reconfigure(
    enabled && isSplitTestEnabled('editor-tabs') ? updateListener : []
  ),
})
