import { Trans, useTranslation } from 'react-i18next'
import { Button, Modal } from 'react-bootstrap'
import AccessibleModal from '@/shared/components/accessible-modal'
import { memo, useState } from 'react'
import { useLocation } from '@/shared/hooks/use-location'

export type OutOfSyncModalProps = {
  editorContent: string
  show: boolean
  onHide: () => void
}

function OutOfSyncModal({ editorContent, show, onHide }: OutOfSyncModalProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [editorContentShown, setEditorContentShown] = useState(false)
  const editorContentRows = (editorContent.match(/\n/g)?.length || 0) + 1

  // Reload the page to avoid staying in an inconsistent state.
  // https://github.com/overleaf/issues/issues/3694
  function done() {
    onHide()
    location.reload()
  }

  return (
    <AccessibleModal
      show={show}
      onHide={done}
      className="out-of-sync-modal"
      backdrop={false}
      keyboard={false}
    >
      <Modal.Header closeButton>
        <Modal.Title>{t('out_of_sync')}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="modal-body-share">
        <Trans
          i18nKey="out_of_sync_detail"
          components={[
            // eslint-disable-next-line react/jsx-key
            <br />,
            // eslint-disable-next-line jsx-a11y/anchor-has-content,react/jsx-key
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="/learn/Kb/Editor_out_of_sync_problems"
            />,
          ]}
        />
      </Modal.Body>
      <Modal.Body>
        <Button
          bsStyle="info"
          onClick={() => setEditorContentShown(shown => !shown)}
        >
          {editorContentShown
            ? t('hide_local_file_contents')
            : t('show_local_file_contents')}
        </Button>
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
      </Modal.Body>
      <Modal.Footer>
        <Button bsStyle="info" onClick={done}>
          {t('reload_editor')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}

export default memo(OutOfSyncModal)
