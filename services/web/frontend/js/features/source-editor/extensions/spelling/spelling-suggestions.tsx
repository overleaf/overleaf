import {
  FC,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { SpellChecker, Word } from './spellchecker'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import classnames from 'classnames'
import { sendMB } from '@/infrastructure/event-tracking'
import SpellingSuggestionsFeedback from './spelling-suggestions-feedback'
import { SpellingSuggestionsLanguage } from './spelling-suggestions-language'
import { captureException } from '@/infrastructure/error-reporter'
import { debugConsole } from '@/utils/debugging'

const ITEMS_TO_SHOW = 8

// (index % length) that works for negative index
const wrapArrayIndex = (index: number, length: number) =>
  ((index % length) + length) % length

export const SpellingSuggestions: FC<{
  word: Word
  spellCheckLanguage?: string
  spellChecker?: SpellChecker | null
  handleClose: () => void
  handleLearnWord: () => void
  handleCorrectWord: (text: string) => void
}> = ({
  word,
  spellCheckLanguage,
  spellChecker,
  handleClose,
  handleLearnWord,
  handleCorrectWord,
}) => {
  const { t } = useTranslation()

  const [suggestions, setSuggestions] = useState(() =>
    Array.isArray(word.suggestions)
      ? word.suggestions.slice(0, ITEMS_TO_SHOW)
      : []
  )

  const [waiting, setWaiting] = useState(!word.suggestions)

  const [selectedIndex, setSelectedIndex] = useState(0)

  const itemsLength = suggestions.length + 1

  useEffect(() => {
    if (!word.suggestions) {
      spellChecker
        ?.suggest(word.text)
        .then(result => {
          setSuggestions(result.suggestions.slice(0, ITEMS_TO_SHOW))
          setWaiting(false)
          sendMB('spelling-suggestion-shown', {
            language: spellCheckLanguage,
            count: result.suggestions.length,
            // word: transaction.state.sliceDoc(mark.from, mark.to),
          })
        })
        .catch(error => {
          captureException(error, {
            tags: { ol_spell_check_language: spellCheckLanguage },
          })
          debugConsole.error(error)
        })
    }
  }, [word, spellChecker, spellCheckLanguage])

  const language = useMemo(() => {
    if (spellCheckLanguage) {
      return (getMeta('ol-languages') ?? []).find(
        item => item.code === spellCheckLanguage
      )
    }
  }, [spellCheckLanguage])

  if (!language) {
    return null
  }

  return (
    <ul
      className={classnames('dropdown-menu', 'dropdown-menu-unpositioned', {
        hidden: waiting,
      })}
      tabIndex={0}
      role="menu"
      onKeyDown={event => {
        switch (event.code) {
          case 'ArrowDown':
            setSelectedIndex(value => wrapArrayIndex(value + 1, itemsLength))
            break

          case 'ArrowUp':
            setSelectedIndex(value => wrapArrayIndex(value - 1, itemsLength))
            break

          case 'Escape':
          case 'Tab':
            event.preventDefault()
            handleClose()
            break
        }
      }}
    >
      {Array.isArray(suggestions) && (
        <>
          {suggestions.map((suggestion, index) => (
            <ListItem
              key={suggestion}
              content={suggestion}
              selected={index === selectedIndex}
              handleClick={event => {
                event.preventDefault()
                handleCorrectWord(suggestion)
              }}
            />
          ))}
          {suggestions.length > 0 && <li className="divider" />}
        </>
      )}
      <ListItem
        content={t('add_to_dictionary')}
        selected={selectedIndex === itemsLength - 1}
        handleClick={event => {
          event.preventDefault()
          handleLearnWord()
        }}
      />

      <li className="divider" />
      <li role="menuitem">
        <SpellingSuggestionsLanguage
          language={language}
          handleClose={handleClose}
        />
      </li>

      {getMeta('ol-isSaas') && (
        <>
          <li className="divider" />
          <li role="menuitem">
            <SpellingSuggestionsFeedback />
          </li>
        </>
      )}
    </ul>
  )
}

const ListItem: FC<{
  content: string
  selected: boolean
  handleClick: MouseEventHandler<HTMLButtonElement>
}> = ({ content, selected, handleClick }) => {
  const handleListItem = useCallback(
    (element: HTMLElement | null) => {
      if (element && selected) {
        window.setTimeout(() => {
          element.focus()
        })
      }
    },
    [selected]
  )

  return (
    <li role="menuitem">
      <button
        className="btn-link text-left dropdown-menu-button"
        onClick={handleClick}
        ref={handleListItem}
      >
        {content}
      </button>
    </li>
  )
}
