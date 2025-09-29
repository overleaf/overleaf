import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import useAsync from '../../../../shared/hooks/use-async'
import { useProjectListContext } from '../../context/project-list-context'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'
import useSelectColor from '../../hooks/use-select-color'
import { editTag } from '../../util/api'
import { getTagColor, MAX_TAG_LENGTH } from '../../util/tag'
import { ColorPicker } from '../color-picker/color-picker'
import { debugConsole } from '@/utils/debugging'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLButton from '@/shared/components/ol/ol-button'
import Notification from '@/shared/components/notification'
import OLFormControl from '@/shared/components/ol/ol-form-control'

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
          .catch(debugConsole.error)
      }
    },
    [runAsync, newTagName, selectedColor, onEdit]
  )

  const handleSubmit = useCallback(
    (e: FormEvent) => {
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
    <OLModal show animation onHide={onClose} id={id} backdrop="static">
      <OLModalHeader>
        <OLModalTitle>{t('edit_tag')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <OLForm onSubmit={handleSubmit}>
          <OLFormGroup controlId="edit-tag-modal">
            <OLFormLabel>{t('edit_tag_name')}</OLFormLabel>
            <OLFormControl
              ref={autoFocusedRef}
              className="form-control"
              type="text"
              name="new-tag-name"
              value={newTagName === undefined ? (tag.name ?? '') : newTagName}
              required
              onChange={e => setNewTagName(e.target.value)}
            />
          </OLFormGroup>
          <OLFormGroup aria-hidden="true">
            <OLFormLabel>{t('tag_color')}</OLFormLabel>:{' '}
            <div>
              <ColorPicker />
            </div>
          </OLFormGroup>
        </OLForm>
        {validationError && (
          <Notification content={validationError} type="error" />
        )}
        {isError && (
          <Notification
            content={t('generic_something_went_wrong')}
            type="error"
          />
        )}
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={onClose} disabled={isLoading}>
          {t('cancel')}
        </OLButton>
        <OLButton
          onClick={() => runEditTag(tag._id)}
          variant="primary"
          disabled={
            isLoading ||
            status === 'pending' ||
            !newTagName?.length ||
            (newTagName === tag?.name && selectedColor === getTagColor(tag)) ||
            !!validationError
          }
          isLoading={isLoading}
          loadingLabel={t('saving')}
        >
          {t('save')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
