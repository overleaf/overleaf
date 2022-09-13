import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Form, FormGroup, Col, FormControl } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import * as eventTracking from '../../../infrastructure/event-tracking'

type SearchFormProps = {
  onChange: (input: string) => void
}

function SearchForm({ onChange }: SearchFormProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const placeholder = `${t('search_projects')}…`

  useEffect(() => {
    onChange(input)
  }, [input, onChange])

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement & Omit<FormControl, keyof HTMLInputElement>
    >
  ) => {
    eventTracking.send(
      'project-list-page-interaction',
      'project-search',
      'keydown'
    )
    setInput(e.target.value)
  }

  const handleClear = () => setInput('')

  return (
    <Form
      horizontal
      className="project-search"
      role="search"
      onSubmit={e => e.preventDefault()}
    >
      <FormGroup className="has-feedback has-feedback-left">
        <Col xs={12}>
          <FormControl
            type="text"
            value={input}
            onChange={handleChange}
            placeholder={placeholder}
            aria-label={placeholder}
          />
          <Icon type="search" className="form-control-feedback-left" />
          {input.length ? (
            <div className="form-control-feedback">
              <button
                type="button"
                className="project-search-clear-btn btn-link"
                aria-label={t('clear_search')}
                onClick={handleClear}
              >
                <Icon type="times" />
              </button>
            </div>
          ) : null}
        </Col>
      </FormGroup>
    </Form>
  )
}

export default SearchForm
