import { useCallback, useState } from 'react'
import { Button, Form, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import useAsync from '../../../../shared/hooks/use-async'
import { renameTag } from '../../util/api'

type RenameTagModalProps = {
  tag?: Tag
  onRename: (tagId: string, newTagName: string) => void
  onClose: () => void
}

export default function RenameTagModal({
  tag,
  onRename,
  onClose,
}: RenameTagModalProps) {
  const { t } = useTranslation()
  const { isError, runAsync, status } = useAsync()

  const [newTagName, setNewTageName] = useState<string>()

  const runRenameTag = useCallback(
    (tagId: string) => {
      if (newTagName) {
        runAsync(renameTag(tagId, newTagName))
          .then(() => onRename(tagId, newTagName))
          .catch(console.error)
      }
    },
    [runAsync, newTagName, onRename]
  )

  const handleSubmit = useCallback(
    e => {
      e.preventDefault()
      if (tag) {
        runRenameTag(tag._id)
      }
    },
    [tag, runRenameTag]
  )

  if (!tag) {
    return null
  }

  return (
    <AccessibleModal
      show
      animation
      onHide={onClose}
      id="rename-tag-modal"
      backdrop="static"
    >
      <Modal.Header closeButton>
        <Modal.Title>{t('rename_folder')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form name="renameTagForm" onSubmit={handleSubmit}>
          <input
            className="form-control"
            type="text"
            placeholder="Tag Name"
            name="new-tag-name"
            value={newTagName === undefined ? tag.name : newTagName}
            required
            onChange={e => setNewTageName(e.target.value)}
          />
        </Form>
      </Modal.Body>

      <Modal.Footer>
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
          onClick={() => runRenameTag(tag._id)}
          bsStyle="primary"
          disabled={status === 'pending' || !newTagName?.length}
        >
          {status === 'pending' ? t('renaming') + '...' : t('rename')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}
