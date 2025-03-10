import { FC } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import HotkeysModal from '@/features/hotkeys-modal/components/hotkeys-modal'
import { isMac } from '@/shared/utils/os'
import { useRailContext } from '../../contexts/rail-context'

export const RailHelpShowHotkeysModal: FC<{ show: boolean }> = ({ show }) => {
  const { features } = useProjectContext()
  const { setActiveModal } = useRailContext()

  return (
    <HotkeysModal
      show={show}
      handleHide={() => setActiveModal(null)}
      isMac={isMac}
      trackChangesVisible={features?.trackChangesVisible}
    />
  )
}
