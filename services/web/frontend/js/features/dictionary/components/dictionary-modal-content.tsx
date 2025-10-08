import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useAsync from '../../../shared/hooks/use-async'
import { postJSON } from '../../../infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLNotification from '@/shared/components/ol/ol-notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import { learnedWords as initialLearnedWords } from '@/features/source-editor/extensions/spelling/learned-words'

type DictionaryModalContentProps = {
  handleHide: () => void
}

const wordsSortFunction = (a: string, b: string) => a.localeCompare(b)

export default function DictionaryModalContent({
  handleHide,
}: DictionaryModalContentProps) {
  const { t } = useTranslation()

  const [learnedWords, setLearnedWords] = useState<Set<string>>(
    initialLearnedWords.global
  )

  const { isError, runAsync } = useAsync()

  const handleRemove = useCallback(
    (word: string) => {
      runAsync(postJSON('/spelling/unlearn', { body: { word } }))
        .then(() => {
          setLearnedWords(prevLearnedWords => {
            const learnedWords = new Set(prevLearnedWords)
            learnedWords.delete(word)
            return learnedWords
          })
          window.dispatchEvent(
            new CustomEvent('editor:remove-learned-word', { detail: word })
          )
        })
        .catch(debugConsole.error)
    },
    [runAsync]
  )

  return (
    <>
      <OLModalHeader>
        <OLModalTitle>{t('edit_dictionary')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        {isError ? (
          <OLNotification
            type="error"
            content={t('generic_something_went_wrong')}
          />
        ) : null}

        {learnedWords.size > 0 ? (
          <ul className="list-unstyled dictionary-entries-list">
            {[...learnedWords].sort(wordsSortFunction).map(learnedWord => (
              <li key={learnedWord} className="dictionary-entry">
                <span className="dictionary-entry-name" translate="no">
                  {learnedWord}
                </span>
                <OLTooltip
                  id={`tooltip-remove-learned-word-${learnedWord}`}
                  description={t('edit_dictionary_remove')}
                  overlayProps={{ delay: 0 }}
                >
                  <OLIconButton
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemove(learnedWord)}
                    icon="delete"
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
