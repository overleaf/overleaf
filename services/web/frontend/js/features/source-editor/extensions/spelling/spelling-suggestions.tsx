import {
  FC,
  MouseEventHandler,
  useEffect,
  useMemo,
  useRef,
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
import {
  Dropdown,
  DropdownDivider,
  DropdownItem,
  DropdownMenu,
} from '@/shared/components/dropdown/dropdown-menu'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'

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
  const menuRef = useRef<any>(null)

  // Handle closing the menu when it loses focus, e.g. click outside the editor
  const onToggle = (show: boolean) => {
    if (!show) {
      handleClose()
    }
  }

  useEffect(() => {
    if (!waiting) {
      menuRef.current?.focus()
    }
  }, [waiting])

  return (
    <Dropdown onToggle={onToggle} show={!waiting}>
      <DropdownMenu
        className={classnames('dropdown-menu-unpositioned', {
          hidden: waiting,
        })}
        ref={menuRef}
        show={!waiting}
        tabIndex={0}
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
          suggestions.map(suggestion => (
            <SpellingListItem
              key={suggestion}
              content={suggestion}
              handleClick={event => {
                event.preventDefault()
                handleCorrectWord(suggestion)
              }}
            />
          ))}
        {suggestions?.length > 0 && <DropdownDivider />}
        <SpellingListItem
          content={t('add_to_dictionary')}
          handleClick={event => {
            event.preventDefault()
            handleLearnWord()
          }}
        />

        <DropdownDivider />
        <SpellingSuggestionsLanguage
          language={language}
          handleClose={handleClose}
        />
      </DropdownMenu>
    </Dropdown>
  )
}

const SpellingListItem: FC<{
  content: string
  handleClick: MouseEventHandler<HTMLButtonElement>
}> = ({ content, handleClick }) => (
  <DropdownListItem>
    <DropdownItem onClick={handleClick}>{content}</DropdownItem>
  </DropdownListItem>
)
