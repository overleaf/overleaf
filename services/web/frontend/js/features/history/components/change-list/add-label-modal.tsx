import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { Modal, FormGroup, FormControl } from 'react-bootstrap'
import ModalError from './modal-error'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import useAsync from '../../../../shared/hooks/use-async'
import useAbortController from '../../../../shared/hooks/use-abort-controller'
import useAddOrRemoveLabels from '../../hooks/use-add-or-remove-labels'
import { useHistoryContext } from '../../context/history-context'
import { addLabel } from '../../services/api'
import { Label } from '../../services/types/label'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'

type AddLabelModalProps = {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  version: number
}

function AddLabelModal({ show, setShow, version }: AddLabelModalProps) {
  const { t } = useTranslation()
  const [comment, setComment] = useState('')
  const {
    isLoading,
    isSuccess,
    isError,
    error,
    data: label,
    reset,
    runAsync,
  } = useAsync<Label>()
  const { projectId } = useHistoryContext()
  const { signal } = useAbortController()
  const { addUpdateLabel } = useAddOrRemoveLabels()

  const { autoFocusedRef, resetAutoFocus } =
    useRefWithAutoFocus<HTMLInputElement>()

  // Reset the autofocus when `show` changes so that autofocus still happens if
  // the dialog is shown, hidden and then shown again
  useEffect(() => {
    if (show) {
      resetAutoFocus()
    }
  }, [resetAutoFocus, show])

  const handleModalExited = () => {
    setComment('')

    if (!isSuccess || !label) return

    addUpdateLabel(label)

    reset()
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    runAsync(addLabel(projectId, { comment, version }, signal))
      .then(() => setShow(false))
      .catch(console.error)
  }

  const responseError = error as unknown as {
    response: Response
    data?: {
      message?: string
    }
  }

  return (
    <AccessibleModal
      show={show}
      onExited={handleModalExited}
      onHide={() => setShow(false)}
      id="add-history-label"
    >
      <Modal.Header>
        <Modal.Title>{t('history_add_label')}</Modal.Title>
      </Modal.Header>
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          {isError && <ModalError error={responseError} />}
          <FormGroup>
            <input
              ref={autoFocusedRef}
              className="form-control"
              type="text"
              placeholder={t('history_new_label_name')}
              required
              value={comment}
              onChange={(
                e: React.ChangeEvent<HTMLInputElement & FormControl>
              ) => setComment(e.target.value)}
            />
          </FormGroup>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isLoading}
            onClick={() => setShow(false)}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !comment.length}
          >
            {isLoading ? t('history_adding_label') : t('history_add_label')}
          </button>
        </Modal.Footer>
      </form>
    </AccessibleModal>
  )
}

export default AddLabelModal
