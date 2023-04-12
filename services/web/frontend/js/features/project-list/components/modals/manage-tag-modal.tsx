import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ControlLabel, Form, FormGroup, Modal } from 'react-bootstrap'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import useAsync from '../../../../shared/hooks/use-async'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'
import useSelectColor from '../../hooks/use-select-color'
import { deleteTag, editTag } from '../../util/api'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import { getTagColor } from '../../util/tag'
import { ColorPicker } from '../color-picker/color-picker'

type ManageTagModalProps = {
  id: string
  tag?: Tag
  onEdit: (tagId: string, newTagName: string, newTagColor?: string) => void
  onDelete: (tagId: string) => void
  onClose: () => void
}

export function ManageTagModal({
  id,
  tag,
  onEdit,
  onDelete,
  onClose,
}: ManageTagModalProps) {
  const { t } = useTranslation()
  const { autoFocusedRef } = useRefWithAutoFocus<HTMLInputElement>()
  const {
    isLoading: isDeleteLoading,
    isError: isDeleteError,
    runAsync: runDeleteAsync,
  } = useAsync()
  const {
    isLoading: isUpdateLoading,
    isError: isRenameError,
    runAsync: runEditAsync,
  } = useAsync()
  const [newTagName, setNewTagName] = useState<string | undefined>(tag?.name)
  const { selectedColor } = useSelectColor(tag?.color)

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

  const runUpdateTag = useCallback(
    (tagId: string) => {
      if (newTagName) {
        runEditAsync(editTag(tagId, newTagName, selectedColor))
          .then(() => onEdit(tagId, newTagName, selectedColor))
          .catch(console.error)
      }
    },
    [runEditAsync, newTagName, selectedColor, onEdit]
  )

  const handleSubmit = useCallback(
    e => {
      e.preventDefault()
      if (tag) {
        runUpdateTag(tag._id)
      }
    },
    [tag, runUpdateTag]
  )

  if (!tag) {
    return null
  }

  return (
    <AccessibleModal show animation onHide={onClose} id={id} backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>{t('edit_tag')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form name="editTagRenameForm" onSubmit={handleSubmit}>
          <FormGroup>
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
          </FormGroup>
          <FormGroup aria-hidden="true">
            <ControlLabel>{t('tag_color')}</ControlLabel>:<br />
            <ColorPicker disableCustomColor />
          </FormGroup>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <div className="clearfix">
          <div className="modal-footer-left">
            <Button
              onClick={() => runDeleteTag(tag._id)}
              bsStyle="danger"
              disabled={isDeleteLoading || isUpdateLoading}
            >
              {isDeleteLoading ? (
                <>{t('deleting')} &hellip;</>
              ) : (
                t('delete_tag')
              )}
            </Button>
          </div>
          <Button
            onClick={onClose}
            disabled={isDeleteLoading || isUpdateLoading}
          >
            {t('save_or_cancel-cancel')}
          </Button>
          <Button
            onClick={() => runUpdateTag(tag._id)}
            bsStyle={null}
            className="btn-secondary"
            disabled={Boolean(
              isUpdateLoading ||
                isDeleteLoading ||
                !newTagName?.length ||
                (newTagName === tag?.name && selectedColor === getTagColor(tag))
            )}
          >
            {isUpdateLoading ? (
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
