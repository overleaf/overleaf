import { FormEvent, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useAsync from '../../../../shared/hooks/use-async'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'
import useSelectColor from '../../hooks/use-select-color'
import { deleteTag, editTag } from '../../util/api'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import { getTagColor } from '../../util/tag'
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
        .catch(debugConsole.error)
    },
    [runDeleteAsync, onDelete]
  )

  const runUpdateTag = useCallback(
    (tagId: string) => {
      if (newTagName) {
        runEditAsync(editTag(tagId, newTagName, selectedColor))
          .then(() => onEdit(tagId, newTagName, selectedColor))
          .catch(debugConsole.error)
      }
    },
    [runEditAsync, newTagName, selectedColor, onEdit]
  )

  const handleSubmit = useCallback(
    (e: FormEvent) => {
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
    <OLModal show animation onHide={onClose} id={id} backdrop="static">
      <OLModalHeader>
        <OLModalTitle>{t('edit_tag')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <OLForm onSubmit={handleSubmit}>
          <OLFormGroup controlId="manage-tag-modal">
            <OLFormLabel>{t('manage_tag')}</OLFormLabel>
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
            <OLFormLabel>{t('tag_color')}</OLFormLabel>:<br />
            <ColorPicker disableCustomColor />
          </OLFormGroup>
        </OLForm>
        {(isDeleteError || isRenameError) && (
          <Notification
            type="error"
            content={t('generic_something_went_wrong')}
          />
        )}
      </OLModalBody>

      <OLModalFooter>
        <OLButton
          variant="danger"
          onClick={() => runDeleteTag(tag._id)}
          className="me-auto"
          disabled={isDeleteLoading || isUpdateLoading}
          isLoading={isDeleteLoading}
          loadingLabel={t('deleting')}
        >
          {t('delete_tag')}
        </OLButton>
        <OLButton
          variant="secondary"
          onClick={onClose}
          disabled={isDeleteLoading || isUpdateLoading}
        >
          {t('save_or_cancel-cancel')}
        </OLButton>
        <OLButton
          variant="primary"
          onClick={() => runUpdateTag(tag._id)}
          disabled={Boolean(
            isUpdateLoading ||
            isDeleteLoading ||
            !newTagName?.length ||
            (newTagName === tag?.name && selectedColor === getTagColor(tag))
          )}
          isLoading={isUpdateLoading}
          loadingLabel={t('saving')}
        >
          {t('save_or_cancel-save')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
