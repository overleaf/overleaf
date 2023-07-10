import { useTranslation } from 'react-i18next'
import EntryContainer from '../entry-container'
import EntryCallout from '../entry-callout'
import Icon from '../../../../../../shared/components/icon'
import BulkActions from './bulk-actions'
import Modal, { useBulkActionsModal } from './modal'
import { ReviewPanelBulkActionsEntry } from '../../../../../../../../types/review-panel/entry'

type BulkActionsEntryProps = {
  entry: ReviewPanelBulkActionsEntry
  nChanges: number
}

function BulkActionsEntry({ entry, nChanges }: BulkActionsEntryProps) {
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
      <EntryContainer>
        {nChanges > 1 && (
          <>
            <EntryCallout
              className="rp-entry-callout-bulk-actions"
              style={{
                top: entry.screenPos
                  ? entry.screenPos.y + entry.screenPos.height - 1 + 'px'
                  : undefined,
              }}
            />
            <BulkActions
              className="rp-entry"
              style={{
                top: entry.screenPos.y + 'px',
                visibility: entry.visible ? 'visible' : 'hidden',
              }}
            >
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
