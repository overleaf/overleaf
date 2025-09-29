import { useTranslation } from 'react-i18next'

import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLNotification from '@/shared/components/ol/ol-notification'
import { useFileTreeSelectable } from '../../contexts/file-tree-selectable'

function FileTreeModalDelete() {
  const { t } = useTranslation()

  const {
    isDeleting,
    inFlight,
    finishDeleting,
    actionedEntities,
    cancel,
    error,
  } = useFileTreeActionable()

  const { select } = useFileTreeSelectable()

  if (!isDeleting) return null // the modal will not be rendered; return early

  function handleHide() {
    cancel()
  }

  function handleDelete() {
    select([])
    finishDeleting()
  }

  return (
    <OLModal show onHide={handleHide}>
      <OLModalHeader>
        <OLModalTitle>{t('delete')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <p>{t('sure_you_want_to_delete')}</p>
        <ul>
          {actionedEntities?.map(entity => (
            <li key={entity._id}>{entity.name}</li>
          ))}
        </ul>
        {error && (
          <OLNotification
            type="error"
            content={t('generic_something_went_wrong')}
          />
        )}
      </OLModalBody>

      <OLModalFooter>
        {inFlight ? (
          <OLButton
            variant="danger"
            disabled
            isLoading
            loadingLabel={t('deleting')}
          />
        ) : (
          <>
            <OLButton variant="secondary" onClick={handleHide}>
              {t('cancel')}
            </OLButton>
            <OLButton variant="danger" onClick={handleDelete}>
              {t('delete')}
            </OLButton>
          </>
        )}
      </OLModalFooter>
    </OLModal>
  )
}

export default FileTreeModalDelete
