import { useCallback, useEffect, useState } from 'react'
import { Button, ControlLabel, Form, FormGroup, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import useAsync from '../../../../shared/hooks/use-async'
import { useProjectListContext } from '../../context/project-list-context'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'
import useSelectColor from '../../hooks/use-select-color'
import { editTag } from '../../util/api'
import { getTagColor, MAX_TAG_LENGTH } from '../../util/tag'
import { ColorPicker } from '../color-picker/color-picker'

type EditTagModalProps = {
  id: string
  tag?: Tag
  onEdit: (tagId: string, newTagName: string, newTagColor?: string) => void
  onClose: () => void
}

export function EditTagModal({ id, tag, onEdit, onClose }: EditTagModalProps) {
  const { tags } = useProjectListContext()
  const { t } = useTranslation()
  const { isLoading, isError, runAsync, status } = useAsync()
  const { autoFocusedRef } = useRefWithAutoFocus<HTMLInputElement>()

  const [newTagName, setNewTagName] = useState<string | undefined>()
  const [validationError, setValidationError] = useState<string>()

  const { selectedColor } = useSelectColor(getTagColor(tag))

  useEffect(() => {
    setNewTagName(tag?.name)
  }, [tag])

  const runEditTag = useCallback(
    (tagId: string) => {
      if (newTagName) {
        const color = selectedColor
        runAsync(editTag(tagId, newTagName, color))
          .then(() => onEdit(tagId, newTagName, color))
          .catch(console.error)
      }
    },
    [runAsync, newTagName, selectedColor, onEdit]
  )

  const handleSubmit = useCallback(
    e => {
      e.preventDefault()
      if (tag) {
        runEditTag(tag._id)
      }
    },
    [tag, runEditTag]
  )

  useEffect(() => {
    if (newTagName && newTagName.length > MAX_TAG_LENGTH) {
      setValidationError(
        t('tag_name_cannot_exceed_characters', { maxLength: MAX_TAG_LENGTH })
      )
    } else if (
      newTagName &&
      newTagName !== tag?.name &&
      tags.find(tag => tag.name === newTagName)
    ) {
      setValidationError(t('tag_name_is_already_used', { tagName: newTagName }))
    } else if (validationError) {
      setValidationError(undefined)
    }
  }, [newTagName, tags, tag?.name, t, validationError])

  if (!tag) {
    return null
  }

  return (
    <AccessibleModal show animation onHide={onClose} id={id} backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>{t('edit_tag')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form name="renameTagForm" onSubmit={handleSubmit}>
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
            <ControlLabel>{t('tag_color')}</ControlLabel>:{' '}
            <div>
              <ColorPicker />
            </div>
          </FormGroup>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        {validationError && (
          <div className="modal-footer-left">
            <span className="text-danger error">{validationError}</span>
          </div>
        )}
        {isError && (
          <div className="modal-footer-left">
            <span className="text-danger error">
              {t('generic_something_went_wrong')}
            </span>
          </div>
        )}
        <Button
          bsStyle={null}
          className="btn-secondary"
          onClick={onClose}
          disabled={isLoading}
        >
          {t('cancel')}
        </Button>
        <Button
          onClick={() => runEditTag(tag._id)}
          bsStyle="primary"
          disabled={
            isLoading ||
            status === 'pending' ||
            !newTagName?.length ||
            (newTagName === tag?.name && selectedColor === getTagColor(tag)) ||
            !!validationError
          }
        >
          {isLoading ? <>{t('saving')} &hellip;</> : t('save')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}
