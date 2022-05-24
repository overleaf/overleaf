import {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useState,
  useRef,
} from 'react'
import { getJSON } from '../../../../../infrastructure/fetch-json'
import useAbortController from '../../../../../shared/hooks/use-abort-controller'
import domainBlocklist from '../../../domain-blocklist'

const LOCAL_AND_DOMAIN_REGEX = /([^@]+)@(.+)/

function matchLocalAndDomain(emailHint: string) {
  const match = emailHint.match(LOCAL_AND_DOMAIN_REGEX)
  if (match) {
    return { local: match[1], domain: match[2] }
  } else {
    return { local: null, domain: null }
  }
}

export type InstitutionInfo = {
  hostname: string
  confirmed?: boolean
  university: {
    id: number
    name: string
    ssoEnabled?: boolean
    ssoBeta?: boolean
  }
}

let domainCache = new Map<string, InstitutionInfo>()

export function clearDomainCache() {
  domainCache = new Map<string, InstitutionInfo>()
}

type InputProps = {
  onChange: (value: string, institution?: InstitutionInfo) => void
  handleAddNewEmail: () => void
}

function Input({ onChange, handleAddNewEmail }: InputProps) {
  const { signal } = useAbortController()

  const inputRef = useRef<HTMLInputElement | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState<string | null>(null)
  const [matchedInstitution, setMatchedInstitution] =
    useState<InstitutionInfo | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [inputRef])

  useEffect(() => {
    if (inputValue == null) {
      return
    }
    if (
      matchedInstitution &&
      inputValue.endsWith(matchedInstitution.hostname)
    ) {
      onChange(inputValue, matchedInstitution)
    } else {
      onChange(inputValue)
    }
  }, [onChange, inputValue, suggestion, matchedInstitution])

  const handleEmailChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const hint = event.target.value
      setInputValue(hint)
      const match = matchLocalAndDomain(hint)
      if (!matchedInstitution?.hostname.startsWith(match.domain)) {
        setSuggestion(null)
      }
      if (!match.domain) {
        return
      }
      if (domainCache.has(match.domain)) {
        const cachedDomain = domainCache.get(match.domain)
        setSuggestion(`${match.local}@${cachedDomain.hostname}`)
        setMatchedInstitution(cachedDomain)
        return
      }
      const query = `?hostname=${match.domain}&limit=1`
      getJSON(`/institutions/domains${query}`, { signal })
        .then(data => {
          if (!(data && data[0])) {
            return
          }
          if (domainBlocklist.has(data[0].hostname)) {
            return
          }
          const hostname = data[0]?.hostname
          if (hostname) {
            domainCache.set(match.domain, data[0])
            setSuggestion(`${match.local}@${hostname}`)
            setMatchedInstitution(data[0])
          } else {
            setSuggestion(null)
            setMatchedInstitution(null)
          }
        })
        .catch(error => {
          setSuggestion(null)
          setMatchedInstitution(null)
          console.error(error)
        })
    },
    [signal, matchedInstitution]
  )

  const handleKeyDownEvent = useCallback(
    (event: KeyboardEvent) => {
      const setInputValueAndResetSuggestion = () => {
        setInputValue(suggestion)
        setSuggestion(null)
      }

      if (event.key === 'Enter') {
        event.preventDefault()

        if (suggestion) {
          setInputValueAndResetSuggestion()
        } else {
          const match = matchLocalAndDomain(inputValue)
          if (match.local && match.domain) {
            handleAddNewEmail()
          }
        }
      }

      if (event.key === 'Tab' && suggestion) {
        event.preventDefault()
        setInputValueAndResetSuggestion()
      }
    },
    [inputValue, suggestion, handleAddNewEmail]
  )

  useEffect(() => {
    if (suggestion && !suggestion.startsWith(inputValue)) {
      setSuggestion(null)
    }
  }, [suggestion, inputValue])

  return (
    <div className="input-suggestions">
      <div className="form-control input-suggestions-shadow">
        <div className="input-suggestions-shadow-suggested">
          {suggestion || ''}
        </div>
      </div>

      <input
        id="affiliations-email"
        className="form-control input-suggestions-main"
        type="email"
        onChange={handleEmailChange}
        onKeyDown={handleKeyDownEvent}
        value={inputValue || ''}
        placeholder="e.g. johndoe@mit.edu"
        ref={inputRef}
      />
    </div>
  )
}

export default Input
