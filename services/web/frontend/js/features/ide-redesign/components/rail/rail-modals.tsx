import { FC } from 'react'
import { RailModalKey, useRailContext } from '../../contexts/rail-context'
import { RailHelpContactUsModal } from '../help/contact-us'
import { RailHelpShowHotkeysModal } from '../help/keyboard-shortcuts'
import DictionarySettingsModal from '../settings/editor-settings/dictionary-settings-modal'

const RAIL_MODALS: {
  key: RailModalKey
  modalComponentFunction: FC<{ show: boolean }>
}[] = [
  {
    key: 'keyboard-shortcuts',
    modalComponentFunction: RailHelpShowHotkeysModal,
  },
  {
    key: 'contact-us',
    modalComponentFunction: RailHelpContactUsModal,
  },
  {
    key: 'dictionary',
    modalComponentFunction: DictionarySettingsModal,
  },
]

export default function RailModals() {
  const { activeModal } = useRailContext()

  return RAIL_MODALS.map(({ key, modalComponentFunction: Component }) => (
    <Component key={key} show={activeModal === key} />
  ))
}
