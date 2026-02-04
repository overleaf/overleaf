import { FC } from 'react'
import {
  RailModalKey,
  useRailContext,
} from '@/features/ide-react/context/rail-context'
import { RailHelpContactUsModal } from '@/features/ide-redesign/components/help/contact-us'
import { RailHelpShowHotkeysModal } from '@/features/ide-redesign/components/help/keyboard-shortcuts'
import DictionarySettingsModal from '@/features/ide-redesign/components/settings/editor-settings/dictionary-settings-modal'

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
