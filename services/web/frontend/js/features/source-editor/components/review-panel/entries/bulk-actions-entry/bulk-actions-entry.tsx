import { useTranslation } from 'react-i18next'
import EntryContainer from '../entry-container'
import EntryCallout from '../entry-callout'
import Icon from '../../../../../../shared/components/icon'
import BulkActions from './bulk-actions'
import Modal, { useBulkActionsModal } from './modal'
import { ReviewPanelBulkActionsEntry } from '../../../../../../../../types/review-panel/entry'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

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
                <BootstrapVersionSwitcher
                  bs3={<Icon type="times" />}
                  bs5={<MaterialIcon type="close" />}
                />
                &nbsp;{t('reject_all')} ({nChanges})
              </BulkActions.Button>
              <BulkActions.Button onClick={handleShowBulkAcceptDialog}>
                <BootstrapVersionSwitcher
                  bs3={<Icon type="check" />}
                  bs5={<MaterialIcon type="check" />}
                />
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
