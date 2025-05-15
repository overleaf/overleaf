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
import { SpellingSuggestionsLanguage } from './spelling-suggestions-language'
import { captureException } from '@/infrastructure/error-reporter'
import { debugConsole } from '@/utils/debugging'
import { SpellCheckLanguage } from '../../../../../../types/project-settings'
import { Dropdown } from 'react-bootstrap'

const ITEMS_TO_SHOW = 8

type SpellingSuggestionsProps = {
  word: Word
  spellCheckLanguage?: string
  spellChecker?: SpellChecker | null
  handleClose: () => void
  handleLearnWord: () => void
  handleCorrectWord: (text: string) => void
}

export const SpellingSuggestions: FC<SpellingSuggestionsProps> = ({
  word,
  spellCheckLanguage,
  spellChecker,
  handleClose,
  handleLearnWord,
  handleCorrectWord,
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([])

  const [waiting, setWaiting] = useState(true)

  useEffect(() => {
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

  const innerProps = {
    suggestions,
    waiting,
    handleClose,
    handleCorrectWord,
    handleLearnWord,
    language,
  }

  return <B5SpellingSuggestions {...innerProps} />
}

type SpellingSuggestionsInnerProps = {
  suggestions: string[]
  waiting: boolean
  handleClose: () => void
  handleCorrectWord: (text: string) => void
  handleLearnWord: () => void
  language: SpellCheckLanguage
}

const B5SpellingSuggestions: FC<SpellingSuggestionsInnerProps> = ({
  suggestions,
  waiting,
  language,
  handleClose,
  handleCorrectWord,
  handleLearnWord,
}) => {
  const { t } = useTranslation()
  return (
    <Dropdown>
      <Dropdown.Menu
        className={classnames('dropdown-menu', 'dropdown-menu-unpositioned', {
          hidden: waiting,
        })}
        show={!waiting}
        tabIndex={0}
        role="menu"
        onKeyDown={event => {
          switch (event.code) {
            case 'Escape':
            case 'Tab':
              event.preventDefault()
              handleClose()
              break
          }
        }}
      >
        {Array.isArray(suggestions) &&
          suggestions.map((suggestion, index) => (
            <BS5ListItem
              key={suggestion}
              content={suggestion}
              handleClick={event => {
                event.preventDefault()
                handleCorrectWord(suggestion)
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={index === 0}
            />
          ))}
        {suggestions?.length > 0 && <Dropdown.Divider />}
        <BS5ListItem
          content={t('add_to_dictionary')}
          handleClick={event => {
            event.preventDefault()
            handleLearnWord()
          }}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={suggestions?.length === 0}
        />

        <Dropdown.Divider />
        <SpellingSuggestionsLanguage
          language={language}
          handleClose={handleClose}
        />
      </Dropdown.Menu>
    </Dropdown>
  )
}

const BS5ListItem: FC<{
  content: string
  handleClick: MouseEventHandler<HTMLButtonElement>
  autoFocus?: boolean
}> = ({ content, handleClick, autoFocus }) => {
  const handleListItem = useCallback(
    (node: HTMLElement | null) => {
      if (node && autoFocus) node.focus()
    },
    [autoFocus]
  )
  return (
    <Dropdown.Item
      role="menuitem"
      className="btn-link text-left dropdown-menu-button"
      onClick={handleClick}
      ref={handleListItem}
    >
      {content}
    </Dropdown.Item>
  )
}
