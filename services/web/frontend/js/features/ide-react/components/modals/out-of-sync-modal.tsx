import { Trans, useTranslation } from 'react-i18next'
import { memo, useEffect, useState } from 'react'
import { useLocation } from '@/shared/hooks/use-location'
import OLButton from '@/shared/components/ol/ol-button'
import { sendMB } from '@/infrastructure/event-tracking'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export type OutOfSyncModalProps = {
  editorContent: string
  show: boolean
  onHide: () => void
}

function OutOfSyncModal({ editorContent, show, onHide }: OutOfSyncModalProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [editorContentShown, setEditorContentShown] = useState(false)
  const themed = useFeatureFlag('themed-modals')
  const editorContentRows = (editorContent.match(/\n/g)?.length || 0) + 1

  useEffect(() => {
    if (show) {
      sendMB('out-of-sync-modal-shown')
    }
  }, [show])

  // Reload the page to avoid staying in an inconsistent state.
  // https://github.com/overleaf/issues/issues/3694
  function done() {
    onHide()
    location.reload()
  }

  return (
    <OLModal
      show={show}
      onHide={done}
      className="out-of-sync-modal"
      backdrop={false}
      keyboard={false}
      themed={themed}
    >
      <OLModalHeader>
        <OLModalTitle>{t('out_of_sync')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody className="modal-body-share">
        <Trans
          i18nKey="out_of_sync_detail"
          components={[
            // eslint-disable-next-line react/jsx-key
            <br />,
            // eslint-disable-next-line jsx-a11y/anchor-has-content,react/jsx-key
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://docs.overleaf.com/troubleshooting-and-support/resolving-pdf-rendering-and-project-loading-problems"
            />,
          ]}
        />
      </OLModalBody>
      <OLModalBody>
        <OLButton
          variant="secondary"
          onClick={() => setEditorContentShown(shown => !shown)}
        >
          {editorContentShown
            ? t('hide_local_file_contents')
            : t('show_local_file_contents')}
        </OLButton>
        {editorContentShown ? (
          <div className="text-preview">
            <textarea
              className="scroll-container"
              readOnly
              rows={editorContentRows}
              value={editorContent}
            />
          </div>
        ) : null}
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={done}>
          {t('reload_editor')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(OutOfSyncModal)
