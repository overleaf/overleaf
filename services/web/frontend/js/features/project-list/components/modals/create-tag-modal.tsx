import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import useAsync from '../../../../shared/hooks/use-async'
import { useProjectListContext } from '../../context/project-list-context'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'
import useSelectColor from '../../hooks/use-select-color'
import { createTag } from '../../util/api'
import { MAX_TAG_LENGTH } from '../../util/tag'
import { ColorPicker } from '../color-picker/color-picker'
import { debugConsole } from '@/utils/debugging'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLFormGroup from '@/features/ui/components/ol/ol-form-group'
import OLFormLabel from '@/features/ui/components/ol/ol-form-label'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLFormControl from '@/features/ui/components/ol/ol-form-control'
import OLForm from '@/features/ui/components/ol/ol-form'
import Notification from '@/shared/components/notification'

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
  const { isLoading, isError, runAsync, status } = useAsync<Tag>()
  const { autoFocusedRef } = useRefWithAutoFocus<HTMLInputElement>()

  const [tagName, setTagName] = useState<string>()
  const [validationError, setValidationError] = useState<string>()

  const runCreateTag = useCallback(() => {
    if (tagName) {
      runAsync(createTag(tagName, selectedColor))
        .then(tag => onCreate(tag))
        .catch(debugConsole.error)
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
    <OLModal show animation onHide={onClose} id={id} backdrop="static">
      <OLModalHeader closeButton>
        <OLModalTitle>{t('create_new_tag')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <OLForm id="create-tag-modal-form" onSubmit={handleSubmit}>
          <OLFormGroup controlId="create-tag-modal-form">
            <OLFormLabel>{t('new_tag_name')}</OLFormLabel>
            <OLFormControl
              name="new-tag-form-name"
              onChange={e => setTagName(e.target.value)}
              ref={autoFocusedRef}
              required
              type="text"
            />
          </OLFormGroup>
          <OLFormGroup aria-hidden="true">
            <OLFormLabel>{t('tag_color')}</OLFormLabel>:{' '}
            <div>
              <ColorPicker disableCustomColor={disableCustomColor} />
            </div>
          </OLFormGroup>
        </OLForm>
        {validationError && (
          <Notification type="error" content={validationError} />
        )}
        {isError && (
          <Notification
            type="error"
            content={t('generic_something_went_wrong')}
          />
        )}
      </OLModalBody>

      <OLModalFooter>
        <OLButton
          variant="secondary"
          onClick={onClose}
          disabled={status === 'pending'}
        >
          {t('cancel')}
        </OLButton>
        <OLButton
          onClick={() => runCreateTag()}
          variant="primary"
          disabled={
            status === 'pending' || !tagName?.length || !!validationError
          }
          isLoading={isLoading}
        >
          {t('create')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
