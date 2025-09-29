import { FC, memo } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'

const ReviewPanelDeleteCommentModal: FC<{
  onHide: () => void
  onDelete: () => void
  title: string
  message: string
}> = ({ onHide, onDelete, title, message }) => {
  const { t } = useTranslation()

  return (
    <OLModal show onHide={onHide}>
      <OLModalHeader>
        <OLModalTitle>{title}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>{message}</OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={onHide}>
          {t('cancel')}
        </OLButton>
        <OLButton variant="danger" onClick={onDelete}>
          {t('delete')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(ReviewPanelDeleteCommentModal)
