import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import useAsync from '../../../../shared/hooks/use-async'
import { deleteTag } from '../../util/api'
import { debugConsole } from '@/utils/debugging'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import Notification from '@/shared/components/notification'

type DeleteTagModalProps = {
  id: string
  tag?: Tag
  onDelete: (tagId: string) => void
  onClose: () => void
}

export default function DeleteTagModal({
  id,
  tag,
  onDelete,
  onClose,
}: DeleteTagModalProps) {
  const { t } = useTranslation()
  const { isLoading, isError, runAsync } = useAsync()

  const runDeleteTag = useCallback(
    (tagId: string) => {
      runAsync(deleteTag(tagId))
        .then(() => {
          onDelete(tagId)
        })
        .catch(debugConsole.error)
    },
    [runAsync, onDelete]
  )

  if (!tag) {
    return null
  }

  return (
    <OLModal show animation onHide={onClose} id={id} backdrop="static">
      <OLModalHeader>
        <OLModalTitle>{t('delete_tag')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        {t('about_to_delete_tag')}
        <ul>
          <li>{tag.name}</li>
        </ul>
        {isError && (
          <Notification
            type="error"
            content={t('generic_something_went_wrong')}
          />
        )}
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={onClose} disabled={isLoading}>
          {t('cancel')}
        </OLButton>
        <OLButton
          onClick={() => runDeleteTag(tag._id)}
          variant="danger"
          disabled={isLoading}
          isLoading={isLoading}
          loadingLabel={t('deleting')}
        >
          {t('delete')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
