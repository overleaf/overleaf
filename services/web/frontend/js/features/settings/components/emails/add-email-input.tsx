import {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useState,
  forwardRef,
} from 'react'
import { getJSON } from '../../../../infrastructure/fetch-json'
import useAbortController from '../../../../shared/hooks/use-abort-controller'

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

type AddEmailInputProps = {
  onChange: (value: string, institution?: InstitutionInfo) => void
  inputRef?: React.ForwardedRef<HTMLInputElement>
}

function AddEmailInputBase({ onChange, inputRef }: AddEmailInputProps) {
  const { signal } = useAbortController()

  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState<string | null>(null)
  const [matchedInstitution, setMatchedInstitution] =
    useState<InstitutionInfo>(null)

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
        }
      }

      if (event.key === 'Tab' && suggestion) {
        event.preventDefault()
        setInputValueAndResetSuggestion()
      }
    },
    [suggestion]
  )

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

const AddEmailInput = forwardRef<
  HTMLInputElement,
  Omit<AddEmailInputProps, 'inputRef'>
>((props, ref) => <AddEmailInputBase {...props} inputRef={ref} />)

AddEmailInput.displayName = 'AddEmailInput'

export { AddEmailInput }
