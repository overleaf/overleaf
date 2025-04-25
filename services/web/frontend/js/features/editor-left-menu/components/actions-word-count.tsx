import { useState, useCallback } from 'react'
import WordCountModal from '../../word-count-modal/components/word-count-modal'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { WordCountButton } from '@/features/word-count-modal/components/word-count-button'

export default function ActionsWordCount() {
  const [showModal, setShowModal] = useState(false)

  const handleShowModal = useCallback(() => {
    eventTracking.sendMB('left-menu-count')
    setShowModal(true)
  }, [])

  return (
    <>
      <WordCountButton handleShowModal={handleShowModal} />
      <WordCountModal show={showModal} handleHide={() => setShowModal(false)} />
    </>
  )
}
