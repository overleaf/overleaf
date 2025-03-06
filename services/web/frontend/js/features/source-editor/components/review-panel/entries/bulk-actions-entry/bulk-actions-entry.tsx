import { useTranslation } from 'react-i18next'
import EntryContainer from '../entry-container'
import EntryCallout from '../entry-callout'
import BulkActions from './bulk-actions'
import Modal, { useBulkActionsModal } from './modal'
import { ReviewPanelBulkActionsEntry } from '../../../../../../../../types/review-panel/entry'
import MaterialIcon from '@/shared/components/material-icon'

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
                <MaterialIcon type="close" />
                &nbsp;{t('reject_all')} ({nChanges})
              </BulkActions.Button>
              <BulkActions.Button onClick={handleShowBulkAcceptDialog}>
                <MaterialIcon type="check" />
                &nbsp;{t('accept_all')} ({nChanges})
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
