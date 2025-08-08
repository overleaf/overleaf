import { useTranslation } from 'react-i18next'
import {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import { WordCountServer } from './word-count-server'
import { WordCountClient } from './word-count-client'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

// NOTE: this component is only mounted when the modal is open
export default function WordCountModalContent({
  handleHide,
}: {
  handleHide: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <OLModalHeader closeButton>
        <OLModalTitle>{t('word_count')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        {isSplitTestEnabled('word-count-client') ? (
          <WordCountClient />
        ) : (
          <WordCountServer />
        )}
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={handleHide}>
          {t('close')}
        </OLButton>
      </OLModalFooter>
    </>
  )
}
