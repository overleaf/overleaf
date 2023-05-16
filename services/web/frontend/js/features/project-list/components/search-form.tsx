import { useTranslation } from 'react-i18next'
import {
  Form,
  FormGroup,
  FormGroupProps,
  Col,
  FormControl,
} from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import * as eventTracking from '../../../infrastructure/event-tracking'
import classnames from 'classnames'
import { Tag } from '../../../../../app/src/Features/Tags/types'
import { Filter } from '../context/project-list-context'

type SearchFormOwnProps = {
  inputValue: string
  setInputValue: (input: string) => void
  filter: Filter
  selectedTag: Tag | undefined
  formGroupProps?: FormGroupProps &
    Omit<React.ComponentProps<'div'>, keyof FormGroupProps>
}

type SearchFormProps = SearchFormOwnProps &
  Omit<React.ComponentProps<typeof Form>, keyof SearchFormOwnProps>

function SearchForm({
  inputValue,
  setInputValue,
  filter,
  selectedTag,
  formGroupProps,
  ...props
}: SearchFormProps) {
  const { t } = useTranslation()
  let placeholderMessage = t('search_projects')
  if (selectedTag) {
    placeholderMessage = `${t('search')} ${selectedTag.name}`
  } else {
    switch (filter) {
      case 'all':
        placeholderMessage = t('search_in_all_projects')
        break
      case 'owned':
        placeholderMessage = t('search_in_your_projects')
        break
      case 'shared':
        placeholderMessage = t('search_in_shared_projects')
        break
      case 'archived':
        placeholderMessage = t('search_in_archived_projects')
        break
      case 'trashed':
        placeholderMessage = t('search_in_trashed_projects')
        break
    }
  }
  const placeholder = `${placeholderMessage}…`
  const { className: formGroupClassName, ...restFormGroupProps } =
    formGroupProps || {}

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement & Omit<FormControl, keyof HTMLInputElement>
    >
  ) => {
    eventTracking.sendMB('project-list-page-interaction', { action: 'search' })
    setInputValue(e.target.value)
  }

  const handleClear = () => setInputValue('')

  return (
    <Form
      horizontal
      className="project-search"
      role="search"
      onSubmit={e => e.preventDefault()}
      {...props}
    >
      <FormGroup
        className={classnames(
          'has-feedback has-feedback-left',
          formGroupClassName
        )}
        {...restFormGroupProps}
      >
        <Col xs={12}>
          <FormControl
            type="text"
            value={inputValue}
            onChange={handleChange}
            placeholder={placeholder}
            aria-label={placeholder}
          />
          <Icon type="search" className="form-control-feedback-left" />
          {inputValue.length ? (
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
