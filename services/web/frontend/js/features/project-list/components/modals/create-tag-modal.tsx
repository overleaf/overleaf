import { useCallback, useEffect, useState } from 'react'
import { Button, ControlLabel, Form, FormGroup, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import useAsync from '../../../../shared/hooks/use-async'
import { useProjectListContext } from '../../context/project-list-context'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'
import useSelectColor from '../../hooks/use-select-color'
import { createTag } from '../../util/api'
import { MAX_TAG_LENGTH } from '../../util/tag'
import { ColorPicker } from '../color-picker/color-picker'

type CreateTagModalProps = {
  id: string
  show: boolean
  onCreate: (tag: Tag) => void
  onClose: () => void
  disableCustomColor?: boolean
}

export default function CreateTagModal({
  id,
  show,
  onCreate,
  onClose,
  disableCustomColor,
}: CreateTagModalProps) {
  const { tags } = useProjectListContext()
  const { selectedColor } = useSelectColor()
  const { t } = useTranslation()
  const { isError, runAsync, status } = useAsync<Tag>()
  const { autoFocusedRef } = useRefWithAutoFocus<HTMLInputElement>()

  const [tagName, setTagName] = useState<string>()
  const [validationError, setValidationError] = useState<string>()

  const runCreateTag = useCallback(() => {
    if (tagName) {
      runAsync(createTag(tagName, selectedColor))
        .then(tag => onCreate(tag))
        .catch(console.error)
    }
  }, [runAsync, tagName, selectedColor, onCreate])

  const handleSubmit = useCallback(
    e => {
      e.preventDefault()
      runCreateTag()
    },
    [runCreateTag]
  )

  useEffect(() => {
    if (tagName && tagName.length > MAX_TAG_LENGTH) {
      setValidationError(
        t('tag_name_cannot_exceed_characters', { maxLength: MAX_TAG_LENGTH })
      )
    } else if (tagName && tags.find(tag => tag.name === tagName)) {
      setValidationError(t('tag_name_is_already_used', { tagName }))
    } else if (validationError) {
      setValidationError(undefined)
    }
  }, [tagName, tags, t, validationError])

  if (!show) {
    return null
  }

  return (
    <AccessibleModal show animation onHide={onClose} id={id} backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>{t('create_new_tag')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form name="createTagForm" onSubmit={handleSubmit}>
          <FormGroup>
            <input
              ref={autoFocusedRef}
              className="form-control"
              type="text"
              placeholder={t('new_tag_name')}
              name="new-tag-form-name"
              required
              onChange={e => setTagName(e.target.value)}
            />
          </FormGroup>
          <FormGroup aria-hidden="true">
            <ControlLabel>{t('tag_color')}</ControlLabel>:{' '}
            <div>
              <ColorPicker disableCustomColor={disableCustomColor} />
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
        <Button onClick={onClose} disabled={status === 'pending'}>
          {t('cancel')}
        </Button>
        <Button
          onClick={() => runCreateTag()}
          bsStyle="primary"
          disabled={
            status === 'pending' || !tagName?.length || !!validationError
          }
        >
          {status === 'pending' ? <>{t('creating')} &hellip;</> : t('create')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}
