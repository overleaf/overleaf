import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Tooltip from '../../../shared/components/tooltip'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import WordCountModal from '../../word-count-modal/components/word-count-modal'
import LeftMenuButton from './left-menu-button'
import * as eventTracking from '../../../infrastructure/event-tracking'

export default function ActionsWordCount() {
  const [showModal, setShowModal] = useState(false)
  const { pdfUrl } = useCompileContext()
  const { t } = useTranslation()

  const handleShowModal = useCallback(() => {
    eventTracking.sendMB('left-menu-count')
    setShowModal(true)
  }, [])

  return (
    <>
      {pdfUrl ? (
        <LeftMenuButton
          onClick={handleShowModal}
          icon={{
            type: 'eye',
            fw: true,
          }}
        >
          {t('word_count')}
        </LeftMenuButton>
      ) : (
        <Tooltip
          id="disabled-word-count"
          description={t('please_compile_pdf_before_word_count')}
          overlayProps={{
            placement: 'top',
          }}
        >
          {/* OverlayTrigger won't fire unless the child is a non-react html element (e.g div, span) */}
          <div>
            <LeftMenuButton
              icon={{
                type: 'eye',
                fw: true,
              }}
              disabled
              disabledAccesibilityText={t(
                'please_compile_pdf_before_word_count'
              )}
            >
              {t('word_count')}
            </LeftMenuButton>
          </div>
        </Tooltip>
      )}
      <WordCountModal show={showModal} handleHide={() => setShowModal(false)} />
    </>
  )
}
