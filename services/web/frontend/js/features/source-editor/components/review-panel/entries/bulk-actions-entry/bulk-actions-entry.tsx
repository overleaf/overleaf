import { useTranslation } from 'react-i18next'
import EntryContainer from '../entry-container'
import EntryCallout from '../entry-callout'
import Icon from '../../../../../../shared/components/icon'
import BulkActions from './bulk-actions'
import Modal, { useBulkActionsModal } from './modal'
import { ReviewPanelBulkActionsEntry } from '../../../../../../../../types/review-panel/entry'

type BulkActionsEntryProps = {
  entryId: ReviewPanelBulkActionsEntry['type']
  nChanges: number
}

function BulkActionsEntry({ entryId, nChanges }: BulkActionsEntryProps) {
  const { t } = useTranslation()
  const {
    show,
    setShow,
    isAccept,
    handleShowBulkAcceptDialog,
    handleShowBulkRejectDialog,
    handleConfirmDialog,
  } = useBulkActionsModal()

  return (
    <>
      <EntryContainer id={entryId}>
        {nChanges > 1 && (
          <>
            <EntryCallout className="rp-entry-callout-bulk-actions" />
            <BulkActions className="rp-entry">
              <BulkActions.Button onClick={handleShowBulkRejectDialog}>
                <Icon type="times" /> {t('reject_all')} ({nChanges})
              </BulkActions.Button>
              <BulkActions.Button onClick={handleShowBulkAcceptDialog}>
                <Icon type="check" /> {t('accept_all')} ({nChanges})
              </BulkActions.Button>
            </BulkActions>
          </>
        )}
      </EntryContainer>
      <Modal
        show={show}
        setShow={setShow}
        isAccept={isAccept}
        nChanges={nChanges}
        onConfirm={handleConfirmDialog}
      />
    </>
  )
}

export default BulkActionsEntry
