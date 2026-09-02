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
import { useFeatureFlag } from '@/shared/context/split-test-context'

const ReviewPanelDeleteCommentModal: FC<{
  onHide: () => void
  onDelete: () => void
  title: string
  message: string
}> = ({ onHide, onDelete, title, message }) => {
  const { t } = useTranslation()
  const themed = useFeatureFlag('themed-modals')

  return (
    <OLModal show onHide={onHide} themed={themed}>
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
