import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Form, Modal } from 'react-bootstrap'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import useAsync from '../../../../shared/hooks/use-async'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'
import { deleteTag, renameTag } from '../../util/api'
import { Tag } from '../../../../../../app/src/Features/Tags/types'

type EditTagModalProps = {
  id: string
  tag?: Tag
  onRename: (tagId: string, newTagName: string) => void
  onDelete: (tagId: string) => void
  onClose: () => void
}

export default function EditTagModal({
  id,
  tag,
  onRename,
  onDelete,
  onClose,
}: EditTagModalProps) {
  const { t } = useTranslation()
  const { autoFocusedRef } = useRefWithAutoFocus<HTMLInputElement>()
  const {
    isLoading: isDeleteLoading,
    isError: isDeleteError,
    runAsync: runDeleteAsync,
  } = useAsync()
  const {
    isLoading: isRenameLoading,
    isError: isRenameError,
    runAsync: runRenameAsync,
  } = useAsync()
  const [newTagName, setNewTagName] = useState<string>()

  const runDeleteTag = useCallback(
    (tagId: string) => {
      runDeleteAsync(deleteTag(tagId))
        .then(() => {
          onDelete(tagId)
        })
        .catch(console.error)
    },
    [runDeleteAsync, onDelete]
  )

  const runRenameTag = useCallback(
    (tagId: string) => {
      if (newTagName) {
        runRenameAsync(renameTag(tagId, newTagName))
          .then(() => onRename(tagId, newTagName))
          .catch(console.error)
      }
    },
    [runRenameAsync, newTagName, onRename]
  )

  const handleSubmit = useCallback(
    e => {
      e.preventDefault()
      if (tag) {
        runRenameTag(tag._id)
      }
    },
    [tag, runRenameTag]
  )

  if (!tag) {
    return null
  }

  return (
    <AccessibleModal show animation onHide={onClose} id={id} backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>{t('edit_folder')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form name="editTagRenameForm" onSubmit={handleSubmit}>
          <input
            ref={autoFocusedRef}
            className="form-control"
            type="text"
            placeholder="Tag Name"
            name="new-tag-name"
            value={newTagName === undefined ? tag.name ?? '' : newTagName}
            required
            onChange={e => setNewTagName(e.target.value)}
          />
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <div className="clearfix">
          <div className="modal-footer-left">
            <Button
              onClick={() => runDeleteTag(tag._id)}
              bsStyle="danger"
              disabled={isDeleteLoading || isRenameLoading}
            >
              {isDeleteLoading ? (
                <>{t('deleting')} &hellip;</>
              ) : (
                t('delete_folder')
              )}
            </Button>
          </div>
          <Button
            onClick={onClose}
            disabled={isDeleteLoading || isRenameLoading}
          >
            {t('save_or_cancel-cancel')}
          </Button>
          <Button
            onClick={() => runRenameTag(tag._id)}
            bsStyle="primary"
            disabled={isRenameLoading || isDeleteLoading || !newTagName?.length}
          >
            {isRenameLoading ? (
              <>{t('saving')} &hellip;</>
            ) : (
              t('save_or_cancel-save')
            )}
          </Button>
        </div>
        {(isDeleteError || isRenameError) && (
          <div className="modal-footer-left mt-2">
            <span className="text-danger error">
              {t('generic_something_went_wrong')}
            </span>
          </div>
        )}
      </Modal.Footer>
    </AccessibleModal>
  )
}
