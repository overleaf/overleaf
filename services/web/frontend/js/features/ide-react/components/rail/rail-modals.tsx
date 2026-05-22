import { FC } from 'react'
import {
  RailModalKey,
  useRailContext,
} from '@/features/ide-react/context/rail-context'
import { RailHelpContactUsModal } from './contact-us'
import { RailHelpShowHotkeysModal } from './keyboard-shortcuts'
import DictionarySettingsModal from '@/features/settings/components/editor-settings/dictionary-settings-modal'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'

type RailModalEntry = {
  key: RailModalKey
  modalComponentFunction: FC<{ show: boolean }>
}

const moduleRailModals = (
  importOverleafModules('railModals') as {
    import: { default: RailModalEntry }
    path: string
  }[]
).map(({ import: { default: entry } }) => entry)

const RAIL_MODALS: RailModalEntry[] = [
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
  ...moduleRailModals,
]

export default function RailModals() {
  const { activeModal } = useRailContext()

  return RAIL_MODALS.map(({ key, modalComponentFunction: Component }) => (
    <Component key={key} show={activeModal === key} />
  ))
}
