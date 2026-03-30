import { FormEvent } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import OLForm from '@/shared/components/ol/ol-form'
import OLAutocomplete, {
  OLAutocompleteItem,
  OLAutocompleteProps,
} from '../../../../frontend/js/shared/components/ol/ol-autocomplete'

const testItems: OLAutocompleteItem[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date' },
  { value: 'elderberry', label: 'Elderberry' },
]

const groupedTestItems: OLAutocompleteItem[] = [
  { value: 'apple', label: 'Apple', group: 'Fruits' },
  { value: 'banana', label: 'Banana', group: 'Fruits' },
  { value: 'carrot', label: 'Carrot', group: 'Vegetables' },
  { value: 'dill', label: 'Dill', group: 'Vegetables' },
]

type RenderProps = Partial<OLAutocompleteProps> &
  Pick<OLAutocompleteProps, 'items'> & {
    onSubmit?: (formData: object) => void
  }

function render(props: RenderProps) {
  const changeHandler = props.onChange || cy.stub().as('changeHandler')
  const label = props.label ?? 'Select item'

  const submitHandler = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (props.onSubmit) {
      const formData = new FormData(event.target as HTMLFormElement)
      props.onSubmit(Object.fromEntries(formData.entries()))
    }
  }

  cy.mount(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      <form onSubmit={submitHandler}>
        <OLAutocomplete
          items={props.items}
          onChange={changeHandler}
          placeholder={props.placeholder}
          label={label}
          showLabel={props.showLabel}
          allowCreate={props.allowCreate}
          disabled={props.disabled}
          createOptionPrefix={props.createOptionPrefix}
          useFuzzySearch={props.useFuzzySearch}
          expandUp={props.expandUp}
        />
        <button type="submit">submit</button>
      </form>
    </div>
  )
}

describe('<OLAutocomplete />', function () {
  describe('initial rendering', function () {
    it('renders with placeholder', function () {
      render({ items: testItems, placeholder: 'Search items...' })
      cy.findByPlaceholderText('Search items...')
    })

    it('renders with visible label', function () {
      render({
        items: testItems,
        label: 'Select item',
        showLabel: true,
      })
      cy.findByRole('combobox', { name: 'Select item' }).should('be.visible')
      cy.findByText('Select item').should('be.visible')
    })

    it('renders with visually hidden label', function () {
      render({
        items: testItems,
        label: 'Select item',
        showLabel: false,
      })
      cy.findByRole('combobox', { name: 'Select item' }).should('exist')
      cy.get('.visually-hidden').should('exist')
    })

    it('starts with empty input', function () {
      render({ items: testItems })
      cy.findByRole('combobox').should('have.value', '')
    })

    it('does not show clear button when empty', function () {
      render({ items: testItems })
      cy.findByLabelText('Delete').should('not.exist')
    })

    it('does not show dropdown initially', function () {
      render({ items: testItems })
      cy.get('.dropdown-menu.show').should('not.exist')
    })
  })

  describe('items rendering', function () {
    it('renders all items when input is focused', function () {
      render({ items: testItems })
      cy.findByRole('combobox').click()

      cy.findByText('Apple')
      cy.findByText('Banana')
      cy.findByText('Cherry')
      cy.findByText('Date')
      cy.findByText('Elderberry')
    })

    it('renders grouped items with headers', function () {
      render({ items: groupedTestItems })
      cy.findByRole('combobox').click()

      cy.contains('Fruits')
      cy.contains('Vegetables')
      cy.findByText('Apple')
      cy.findByText('Banana')
      cy.findByText('Carrot')
      cy.findByText('Dill')
    })

    it('separates groups with dividers', function () {
      render({ items: groupedTestItems })
      cy.findByRole('combobox').click()

      cy.get('.dropdown-divider').should('have.length', 1)
    })

    it('shows dropdown when typing', function () {
      render({ items: testItems })
      cy.findByRole('combobox').type('a')

      cy.get('.dropdown-menu.show').should('exist')
    })
  })

  describe('filtering', function () {
    it('filters items based on input', function () {
      render({ items: testItems })
      cy.findByRole('combobox').type('ba')

      cy.findByText('Banana').should('exist')
      cy.findByText('Apple').should('not.exist')
      cy.findByText('Cherry').should('not.exist')
    })

    it('filters items case-insensitively', function () {
      render({ items: testItems })
      cy.findByRole('combobox').type('CHERRY')

      cy.findByText('Cherry').should('exist')
      cy.findByText('Apple').should('not.exist')
    })

    it('shows all items when input is cleared', function () {
      render({ items: testItems })
      cy.findByRole('combobox').type('ba')
      cy.findByText('Banana').should('exist')

      cy.findByRole('combobox').clear()
      cy.findByRole('combobox').click()
      cy.findByText('Apple').should('exist')
      cy.findByText('Cherry').should('exist')
    })

    it('filters grouped items', function () {
      render({ items: groupedTestItems })
      cy.findByRole('combobox').type('car')

      cy.findByText('Carrot').should('exist')
      cy.contains('Vegetables').should('exist')
      cy.findByText('Apple').should('not.exist')
      cy.contains('Fruits').should('not.exist')
    })

    it('hides empty groups after filtering', function () {
      render({ items: groupedTestItems })
      cy.findByRole('combobox').type('app')

      cy.findByText('Apple').should('exist')
      cy.contains('Fruits').should('exist')
      cy.contains('Vegetables').should('not.exist')
    })
  })

  describe('fuzzy search', function () {
    it('performs fuzzy search when enabled', function () {
      render({ items: testItems, useFuzzySearch: true })
      cy.findByRole('combobox').type('aple')

      cy.findByText('Apple').should('exist')
    })

    it('performs fuzzy search on grouped items', function () {
      render({ items: groupedTestItems, useFuzzySearch: true })
      cy.findByRole('combobox').type('banan')

      cy.findByText('Banana').should('exist')
    })
  })

  describe('item selection', function () {
    it('selects an item on click', function () {
      const changeHandler = cy.stub().as('changeHandler')
      render({ items: testItems, onChange: changeHandler })

      cy.findByRole('combobox').click()
      cy.findByText('Banana').click()

      cy.get('@changeHandler').should('have.been.calledOnceWith', 'banana')
      cy.findByRole('combobox').should('have.value', 'Banana')
    })

    it('closes dropdown after selection', function () {
      render({ items: testItems })
      cy.findByRole('combobox').click()
      cy.findByText('Cherry').click()

      cy.get('.dropdown-menu.show').should('not.exist')
    })

    it('displays clear button after selection', function () {
      render({ items: testItems })
      cy.findByRole('combobox').click()
      cy.findByText('Apple').click()

      cy.findByLabelText('Delete').should('exist')
    })

    it('cannot select when disabled', function () {
      render({ items: testItems, disabled: true })
      cy.findByRole('combobox').should('be.disabled')
      cy.findByRole('combobox').click({ force: true })

      cy.get('.dropdown-menu.show').should('not.exist')
    })

    it('does not show clear button when disabled', function () {
      render({ items: testItems, disabled: true })
      cy.findByRole('combobox').type('Apple', { force: true })

      cy.findByLabelText('Delete').should('not.exist')
    })
  })

  describe('clear button', function () {
    it('clears the input when clicked', function () {
      const changeHandler = cy.stub().as('changeHandler')
      render({ items: testItems, onChange: changeHandler })

      cy.findByRole('combobox').type('Apple')
      cy.findByLabelText('Delete').click()

      cy.findByRole('combobox').should('have.value', '')
      cy.get('@changeHandler').should('have.been.calledWith', '')
    })

    it('restores all items after clearing', function () {
      render({ items: testItems })
      cy.findByRole('combobox').type('ba')
      cy.findByText('Banana').should('exist')
      cy.findByText('Apple').should('not.exist')

      cy.findByLabelText('Delete').click()
      cy.findByRole('combobox').click()

      cy.findByText('Apple').should('exist')
      cy.findByText('Banana').should('exist')
      cy.findByText('Cherry').should('exist')
    })
  })

  describe('create option', function () {
    it('shows create option when input does not match any item', function () {
      render({ items: testItems, allowCreate: true })
      cy.findByRole('combobox').type('grape')

      cy.contains("+ Create 'grape'").should('exist')
    })

    it('does not show create option when input matches an item', function () {
      render({ items: testItems, allowCreate: true })
      cy.findByRole('combobox').type('Apple')

      cy.contains('+ Create').should('not.exist')
    })

    it('shows create option with case-insensitive matching', function () {
      render({ items: testItems, allowCreate: true })
      cy.findByRole('combobox').type('apple')

      cy.contains('+ Create').should('not.exist')
    })

    it('invokes onChange with new value when create option is selected', function () {
      const changeHandler = cy.stub().as('changeHandler')
      render({ items: testItems, allowCreate: true, onChange: changeHandler })

      cy.findByRole('combobox').type('grape')
      cy.contains("+ Create 'grape'").click()

      cy.get('@changeHandler').should('have.been.calledWithMatch', /grape$/)
      cy.findByRole('combobox').should('have.value', 'grape')
    })

    it('does not show create option when allowCreate is false', function () {
      render({ items: testItems, allowCreate: false })
      cy.findByRole('combobox').type('grape')

      cy.contains('+ Create').should('not.exist')
    })

    it('does not show create option when allowCreate function returns false', function () {
      render({
        items: testItems,
        allowCreate: value => value !== 'grape',
      })
      cy.findByRole('combobox').type('grape')

      cy.contains('+ Create').should('not.exist')
    })

    it('shows create option when allowCreate function returns true', function () {
      render({
        items: testItems,
        allowCreate: value => value.length > 2,
      })
      cy.findByRole('combobox').type('grape')

      cy.contains("+ Create 'grape'").should('exist')
    })

    it('uses custom create option prefix', function () {
      render({
        items: testItems,
        allowCreate: true,
        createOptionPrefix: 'Add new:',
      })
      cy.findByRole('combobox').type('grape')

      cy.contains("Add new: 'grape'").should('exist')
      cy.contains('+ Create').should('not.exist')
    })

    it('shows create option with groups', function () {
      render({ items: groupedTestItems, allowCreate: true })
      cy.findByRole('combobox').type('grape')

      cy.contains("+ Create 'grape'").should('exist')
    })

    it('separates create option with divider in grouped view', function () {
      render({ items: groupedTestItems, allowCreate: true })
      cy.findByRole('combobox').type('a')

      cy.contains("+ Create 'a'").should('exist')

      cy.get('.dropdown-divider').should('have.length', 2)
    })
  })

  describe('keyboard navigation', function () {
    it('opens dropdown on ArrowDown key', function () {
      render({ items: testItems })
      cy.findByRole('combobox').type('{downArrow}')

      cy.get('.dropdown-menu.show').should('exist')
    })

    it('selects first item on Enter when no item is highlighted', function () {
      const changeHandler = cy.stub().as('changeHandler')
      render({ items: testItems, onChange: changeHandler })

      cy.findByRole('combobox').type('b{enter}')

      cy.get('@changeHandler').should('have.been.calledWith', 'banana')
    })

    it('navigates through items with arrow keys', function () {
      render({ items: testItems })
      cy.findByRole('combobox').click()

      cy.get('.dropdown-item-highlighted').should('contain', 'Apple')

      cy.findByRole('combobox').type('{downArrow}')
      cy.get('.dropdown-item-highlighted').should('contain', 'Banana')

      cy.findByRole('combobox').type('{downArrow}')
      cy.get('.dropdown-item-highlighted').should('contain', 'Cherry')
    })

    it('selects highlighted item on Enter', function () {
      const changeHandler = cy.stub().as('changeHandler')
      render({ items: testItems, onChange: changeHandler })

      cy.findByRole('combobox').click()

      cy.findByRole('combobox').type('{downArrow}{enter}')

      cy.get('@changeHandler').should('have.been.calledWith', 'banana')
    })

    it('can navigate to and select create option', function () {
      const changeHandler = cy.stub().as('changeHandler')
      render({ items: testItems, allowCreate: true, onChange: changeHandler })

      cy.findByRole('combobox').type('grape')
      // Navigate down through all items to the create option
      cy.findByRole('combobox').type('{downArrow}'.repeat(6) + '{enter}')

      cy.get('@changeHandler').should('have.been.calledWith', 'grape')
    })
  })

  describe('form integration', function () {
    it('works within a form context', function () {
      const FormWithAutocomplete = ({
        onSubmit,
      }: {
        onSubmit: (formData: object) => void
      }) => {
        const changeHandler = cy.stub().as('formChangeHandler')

        function handleSubmit(event: FormEvent<HTMLFormElement>) {
          event.preventDefault()
          const formData = new FormData(event.target as HTMLFormElement)
          onSubmit(Object.fromEntries(formData.entries()))
        }

        return (
          <OLForm onSubmit={handleSubmit}>
            <input
              type="hidden"
              name="autocomplete_value"
              value=""
              ref={ref => {
                if (ref) {
                  // Update hidden input when autocomplete changes
                  const observer = new MutationObserver(() => {
                    const autocompleteInput = ref.form?.querySelector(
                      'input[type="text"]'
                    ) as HTMLInputElement
                    if (autocompleteInput) {
                      ref.value = autocompleteInput.value
                    }
                  })
                  if (ref.form) {
                    observer.observe(ref.form, {
                      subtree: true,
                      attributes: true,
                    })
                  }
                }
              }}
            />
            <OLAutocomplete
              items={testItems}
              onChange={changeHandler}
              placeholder="Search..."
              label="Select item"
            />
            <OLButton type="submit">submit</OLButton>
          </OLForm>
        )
      }

      const submitHandler = cy.stub().as('submitHandler')
      cy.mount(
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
          }}
        >
          <FormWithAutocomplete onSubmit={submitHandler} />
        </div>
      )

      cy.findByRole('combobox').click()
      cy.findByText('Banana').click()

      cy.get('@formChangeHandler').should('have.been.calledWith', 'banana')
    })
  })

  describe('edge cases', function () {
    it('handles empty items array', function () {
      render({ items: [] })
      cy.findByRole('combobox').click()

      cy.get('.dropdown-menu.show').should('not.exist')
    })

    it('handles empty groups array', function () {
      render({ items: [] })
      cy.findByRole('combobox').click()

      cy.get('.dropdown-menu.show').should('not.exist')
    })

    it('shows only create option when no items match', function () {
      render({ items: testItems, allowCreate: true })
      cy.findByRole('combobox').type('xyz')

      cy.contains("+ Create 'xyz'").should('exist')
      cy.findByText('Apple').should('not.exist')
    })

    it('does not trim whitespace in comparisons', function () {
      render({ items: testItems, allowCreate: true })
      cy.findByRole('combobox').type('  apple  ')

      cy.contains('+ Create').should('exist')
    })
  })

  describe('expandUp prop', function () {
    it('renders search bar before results list when expandUp is false', function () {
      render({ items: testItems, expandUp: false })
      cy.findByRole('combobox').click()

      cy.get('.ol-autocomplete').within(() => {
        cy.get('.dropdown-menu').then($menu => {
          cy.findByRole('combobox').then($input => {
            const inputTop = $input[0].getBoundingClientRect().top
            const menuTop = $menu[0].getBoundingClientRect().top
            expect(inputTop).to.be.lessThan(menuTop)
          })
        })
      })
    })

    it('renders results list before search bar when expandUp is true', function () {
      render({ items: testItems, expandUp: true })
      cy.findByRole('combobox').click()

      cy.get('.ol-autocomplete').within(() => {
        cy.get('.dropdown-menu').then($menu => {
          cy.findByRole('combobox').then($input => {
            const inputTop = $input[0].getBoundingClientRect().top
            const menuTop = $menu[0].getBoundingClientRect().top
            expect(menuTop).to.be.lessThan(inputTop)
          })
        })
      })
    })

    it('applies correct margin class when expandUp is false', function () {
      render({ items: testItems, expandUp: false })

      cy.get('.ol-autocomplete').within(() => {
        cy.get('.mb-3').should('exist')
        cy.get('.mt-3').should('not.exist')
      })
    })

    it('applies correct margin class when expandUp is true', function () {
      render({ items: testItems, expandUp: true })

      cy.get('.ol-autocomplete').within(() => {
        cy.get('.mt-3').should('exist')
        cy.get('.mb-3').should('not.exist')
      })
    })
  })
})
