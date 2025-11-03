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
import SplitTestBadge from '@/shared/components/split-test-badge'
import { useEffect } from 'react'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'

// NOTE: this component is only mounted when the modal is open
export default function WordCountModalContent({
  handleHide,
}: {
  handleHide: () => void
}) {
  const { t } = useTranslation()

  const { sendEvent } = useEditorAnalytics()

  useEffect(() => {
    // record when the word count modal is opened
    sendEvent('word-count-opened', {
      mode: isSplitTestEnabled('word-count-client') ? 'client' : 'server',
    })
  }, [sendEvent])

  return (
    <>
      <OLModalHeader>
        <OLModalTitle>
          {t('word_count_lower')}{' '}
          <SplitTestBadge
            splitTestName="word-count-client"
            displayOnVariants={['enabled']}
          />
        </OLModalTitle>
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
