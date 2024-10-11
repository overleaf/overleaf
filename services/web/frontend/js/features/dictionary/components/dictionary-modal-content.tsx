import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useAsync from '../../../shared/hooks/use-async'
import { postJSON } from '../../../infrastructure/fetch-json'
import ignoredWords from '../ignored-words'
import { debugConsole } from '@/utils/debugging'
import {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLNotification from '@/features/ui/components/ol/ol-notification'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'
import { bsVersion } from '@/features/utils/bootstrap-5'

type DictionaryModalContentProps = {
  handleHide: () => void
}

const wordsSortFunction = (a: string, b: string) => a.localeCompare(b)

export default function DictionaryModalContent({
  handleHide,
}: DictionaryModalContentProps) {
  const { t } = useTranslation()
  const [learnedWords, setLearnedWords] = useState(ignoredWords.learnedWords)

  const { isError, runAsync } = useAsync()

  const handleRemove = useCallback(
    word => {
      runAsync(
        postJSON('/spelling/unlearn', {
          body: {
            word,
          },
        })
      )
        .then(() => {
          ignoredWords.remove(word)
          setLearnedWords(new Set(ignoredWords.learnedWords))
        })
        .catch(debugConsole.error)
    },
    [runAsync]
  )

  return (
    <>
      <OLModalHeader closeButton>
        <OLModalTitle>{t('edit_dictionary')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        {isError ? (
          <OLNotification
            type="error"
            content={t('generic_something_went_wrong')}
          />
        ) : null}

        {learnedWords?.size > 0 ? (
          <ul className="list-unstyled dictionary-entries-list">
            {[...learnedWords].sort(wordsSortFunction).map(learnedWord => (
              <li key={learnedWord} className="dictionary-entry">
                <span className="dictionary-entry-name">{learnedWord}</span>
                <OLTooltip
                  id={`tooltip-remove-learned-word-${learnedWord}`}
                  description={t('edit_dictionary_remove')}
                  overlayProps={{ delay: 0 }}
                >
                  <OLIconButton
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemove(learnedWord)}
                    bs3Props={{ bsSize: 'xsmall' }}
                    icon={
                      bsVersion({
                        bs5: 'delete',
                        bs3: 'trash-o',
                      }) as string
                    }
                    accessibilityLabel={t('edit_dictionary_remove')}
                  />
                </OLTooltip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dictionary-empty-body text-center">
            <i>{t('edit_dictionary_empty')}</i>
          </p>
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
