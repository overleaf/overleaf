import { useCallback, useState } from 'react'
import { Button, Form, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import useAsync from '../../../../shared/hooks/use-async'
import { createTag } from '../../util/api'

type CreateTagModalProps = {
  show: boolean
  onCreate: (tag: Tag) => void
  onClose: () => void
}

export default function CreateTagModal({
  show,
  onCreate,
  onClose,
}: CreateTagModalProps) {
  const { t } = useTranslation()
  const { isError, runAsync, status } = useAsync<Tag>()

  const [tagName, setTagName] = useState<string>()

  const runCreateTag = useCallback(() => {
    if (tagName) {
      runAsync(createTag(tagName))
        .then(tag => onCreate(tag))
        .catch(console.error)
    }
  }, [runAsync, tagName, onCreate])

  const handleSubmit = useCallback(
    e => {
      e.preventDefault()
      runCreateTag()
    },
    [runCreateTag]
  )

  if (!show) {
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
        <Modal.Title>{t('create_new_folder')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form name="createTagForm" onSubmit={handleSubmit}>
          <input
            className="form-control"
            type="text"
            placeholder="New Tag Name"
            name="new-tag-name"
            required
            onChange={e => setTagName(e.target.value)}
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
          onClick={() => runCreateTag()}
          bsStyle="primary"
          disabled={status === 'pending' || !tagName?.length}
        >
          {status === 'pending' ? t('creating') + '...' : t('create')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}
