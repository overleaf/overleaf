import DictionaryModal from '@/features/dictionary/components/dictionary-modal'
import { useRailContext } from '@/features/ide-react/context/rail-context'
import { useCallback } from 'react'

export default function DictionarySettingsModal({ show }: { show: boolean }) {
  const { setActiveModal } = useRailContext()
  const handleHide = useCallback(() => setActiveModal(null), [setActiveModal])

  return <DictionaryModal show={show} handleHide={handleHide} />
}
