import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuItem } from 'react-bootstrap'
import Icon from '../../../../../../shared/components/icon'
import AddLabelModal from '../../add-label-modal'

type DownloadProps = {
  projectId: string
  version: number
  closeDropdown: () => void
}

function AddLabel({
  version,
  projectId,
  closeDropdown,
  ...props
}: DownloadProps) {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)

  const handleClick = () => {
    closeDropdown()
    setShowModal(true)
  }

  return (
    <>
      <MenuItem onClick={handleClick} {...props}>
        <Icon type="tag" fw /> {t('history_label_this_version')}
      </MenuItem>
      <AddLabelModal
        show={showModal}
        setShow={setShowModal}
        version={version}
      />
    </>
  )
}

export default AddLabel
