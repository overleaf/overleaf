import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DropdownMenuItem from '@/shared/components/dropdown/dropdown-menu-item'
import TagIcon from '@/shared/components/tag-icon'
import AddLabelModal from '../../add-label-modal'

type AddLabelProps = {
  version: number
  closeDropdown: () => void
}

function AddLabel({ version, closeDropdown, ...props }: AddLabelProps) {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)

  const handleClick = () => {
    closeDropdown()
    setShowModal(true)
  }

  return (
    <>
      <DropdownMenuItem
        onClick={handleClick}
        leadingIcon={<TagIcon />}
        as="button"
        className="dropdown-item-material-icon-small"
        {...props}
      >
        {t('history_label_this_version')}
      </DropdownMenuItem>
      <AddLabelModal
        show={showModal}
        setShow={setShowModal}
        version={version}
      />
    </>
  )
}

export default AddLabel
