import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import ModalError from './modal-error'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import useAsync from '../../../../shared/hooks/use-async'
import useAbortController from '../../../../shared/hooks/use-abort-controller'
import useAddOrRemoveLabels from '../../hooks/use-add-or-remove-labels'
import { useHistoryContext } from '../../context/history-context'
import { addLabel } from '../../services/api'
import { Label } from '../../services/types/label'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'
import { debugConsole } from '@/utils/debugging'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormLabel from '@/shared/components/ol/ol-form-label'

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
      .catch(debugConsole.error)
  }

  const responseError = error as unknown as {
    response: Response
    data?: {
      message?: string
    }
  }

  return (
    <OLModal
      show={show}
      onExited={handleModalExited}
      onHide={() => setShow(false)}
      id="add-history-label"
    >
      <OLModalHeader>
        <OLModalTitle>{t('history_add_label')}</OLModalTitle>
      </OLModalHeader>
      <OLForm onSubmit={handleSubmit}>
        <OLModalBody>
          {isError && <ModalError error={responseError} />}
          <OLFormGroup controlId="add-label-modal">
            <OLFormLabel>{t('history_new_label_name')}</OLFormLabel>
            <OLFormControl
              ref={autoFocusedRef}
              type="text"
              required
              value={comment}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setComment(e.target.value)
              }
            />
          </OLFormGroup>
        </OLModalBody>
        <OLModalFooter>
          <OLButton
            variant="secondary"
            disabled={isLoading}
            onClick={() => setShow(false)}
          >
            {t('cancel')}
          </OLButton>
          <OLButton
            type="submit"
            variant="primary"
            disabled={isLoading || !comment.length}
            isLoading={isLoading}
            loadingLabel={t('adding')}
          >
            {t('history_add_label')}
          </OLButton>
        </OLModalFooter>
      </OLForm>
    </OLModal>
  )
}

export default AddLabelModal
