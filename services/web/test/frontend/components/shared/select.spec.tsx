import '../../helpers/bootstrap-3'
import { useCallback, FormEvent } from 'react'
import { Button, Form, FormControl } from 'react-bootstrap'
import {
  Select,
  SelectProps,
} from '../../../../frontend/js/shared/components/select'

const testData = [1, 2, 3].map(index => ({
  key: index,
  value: `Demo item ${index}`,
  sub: `Subtitle ${index}`,
}))

type RenderProps = Partial<SelectProps<(typeof testData)[number]>> & {
  onSubmit?: (formData: object) => void
}

function render(props: RenderProps) {
  const submitHandler = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (props.onSubmit) {
      const formData = new FormData(event.target as HTMLFormElement)
      // a plain object is more convenient to work later with assertions
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
        <Select
          items={testData}
          itemToString={x => String(x?.value)}
          label={props.label}
          name="select_control"
          defaultText={props.defaultText}
          defaultItem={props.defaultItem}
          itemToSubtitle={props.itemToSubtitle}
          itemToKey={x => String(x.key)}
          onSelectedItemChanged={props.onSelectedItemChanged}
          selected={props.selected}
          disabled={props.disabled}
          itemToDisabled={props.itemToDisabled}
          optionalLabel={props.optionalLabel}
          loading={props.loading}
          selectedIcon={props.selectedIcon}
        />
        <button type="submit">submit</button>
      </form>
    </div>
  )
}

describe('<Select />', function () {
  describe('initial rendering', function () {
    it('renders default text', function () {
      render({ defaultText: 'Choose an item' })
      cy.findByTestId('spinner').should('not.exist')
      cy.findByText('Choose an item')
    })

    it('renders default item', function () {
      render({ defaultItem: testData[2] })
      cy.findByText('Demo item 3')
    })

    it('default item takes precedence over default text', function () {
      render({ defaultText: 'Choose an item', defaultItem: testData[2] })
      cy.findByText('Demo item 3')
    })

    it('renders label', function () {
      render({
        defaultText: 'Choose an item',
        label: 'test label',
        optionalLabel: false,
      })
      cy.findByText('test label')
      cy.findByText('(Optional)').should('not.exist')
    })

    it('renders optional label', function () {
      render({
        defaultText: 'Choose an item',
        label: 'test label',
        optionalLabel: true,
      })
      cy.findByText('test label')
      cy.findByText('(Optional)')
    })

    it('renders a spinner while loading when there is a label', function () {
      render({
        defaultText: 'Choose an item',
        label: 'test label',
        loading: true,
      })
      cy.findByTestId('spinner')
    })

    it('does not render a spinner while loading if there is no label', function () {
      render({
        defaultText: 'Choose an item',
        loading: true,
      })
      cy.findByTestId('spinner').should('not.exist')
    })
  })

  describe('items rendering', function () {
    it('renders all items', function () {
      render({ defaultText: 'Choose an item' })
      cy.findByText('Choose an item').click()

      cy.findByText('Demo item 1')
      cy.findByText('Demo item 2')
      cy.findByText('Demo item 3')
    })

    it('renders subtitles', function () {
      render({
        defaultText: 'Choose an item',
        itemToSubtitle: x => String(x?.sub),
      })
      cy.findByText('Choose an item').click()

      cy.findByText('Subtitle 1')
      cy.findByText('Subtitle 2')
      cy.findByText('Subtitle 3')
    })
  })

  describe('item selection', function () {
    it('cannot select an item when disabled', function () {
      render({ defaultText: 'Choose an item', disabled: true })
      cy.findByText('Choose an item').click()

      cy.findByText('Demo item 1').should('not.exist')
      cy.findByText('Demo item 2').should('not.exist')
      cy.findByText('Demo item 3').should('not.exist')
      cy.findByText('Choose an item')
    })

    it('renders only the selected item after selection', function () {
      render({ defaultText: 'Choose an item' })
      cy.findByText('Choose an item').click()

      cy.findByText('Demo item 1')
      cy.findByText('Demo item 2')
      cy.findByText('Demo item 3').click()

      cy.findByText('Choose an item').should('not.exist')
      cy.findByText('Demo item 1').should('not.exist')
      cy.findByText('Demo item 2').should('not.exist')
      cy.findByText('Demo item 3')
    })

    it('invokes callback after selection', function () {
      const selectionHandler = cy.stub().as('selectionHandler')

      render({
        defaultText: 'Choose an item',
        onSelectedItemChanged: selectionHandler,
      })
      cy.findByText('Choose an item').click()
      cy.findByText('Demo item 2').click()

      cy.get('@selectionHandler').should(
        'have.been.calledOnceWith',
        testData[1]
      )
    })
  })

  describe('when the form is submitted', function () {
    it('populates FormData with the default selected item', function () {
      const submitHandler = cy.stub().as('submitHandler')
      render({ defaultItem: testData[1], onSubmit: submitHandler })

      cy.findByText('submit').click()
      cy.get('@submitHandler').should('have.been.calledOnceWith', {
        select_control: 'Demo item 2',
      })
    })

    it('populates FormData with the selected item', function () {
      const submitHandler = cy.stub().as('submitHandler')
      render({ defaultItem: testData[1], onSubmit: submitHandler })

      cy.findByText('Demo item 2').click() // open dropdown
      cy.findByText('Demo item 3').click() // choose a different item

      cy.findByText('submit').click()
      cy.get('@submitHandler').should('have.been.calledOnceWith', {
        select_control: 'Demo item 3',
      })
    })

    it('does not populate FormData when no item is selected', function () {
      const submitHandler = cy.stub().as('submitHandler')
      render({ defaultText: 'Choose an item', onSubmit: submitHandler })

      cy.findByText('submit').click()
      cy.get('@submitHandler').should('have.been.calledOnceWith', {})
    })
  })

  describe('with react-bootstrap forms', function () {
    type FormWithSelectProps = {
      onSubmit: (formData: object) => void
    }

    const FormWithSelect = ({ onSubmit }: FormWithSelectProps) => {
      const selectComponent = useCallback(
        () => (
          <Select
            name="select_control"
            items={testData}
            defaultItem={testData[0]}
            itemToString={x => String(x?.value)}
            itemToKey={x => String(x.key)}
          />
        ),
        []
      )

      function handleSubmit(event: FormEvent<Form>) {
        event.preventDefault()
        const formData = new FormData(event.target as HTMLFormElement)
        // a plain object is more convenient to work later with assertions
        onSubmit(Object.fromEntries(formData.entries()))
      }

      return (
        <Form onSubmit={handleSubmit}>
          <FormControl componentClass={selectComponent} />
          <Button type="submit">submit</Button>
        </Form>
      )
    }

    it('populates FormData with the selected item when the form is submitted', function () {
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
          <FormWithSelect onSubmit={submitHandler} />
        </div>
      )

      cy.findByText('Demo item 1').click() // open dropdown
      cy.findByText('Demo item 3').click() // choose a different item

      cy.findByText('submit').click()
      cy.get('@submitHandler').should('have.been.calledOnceWith', {
        select_control: 'Demo item 3',
      })
    })
  })

  describe('keyboard navigation', function () {
    it('can select an item using the keyboard', function () {
      render({ defaultText: 'Choose an item' })
      cy.findByText('Choose an item').type('{Enter}{downArrow}{Enter}')
      cy.findByText('Demo item 1').should('exist')
      cy.findByText('Demo item 2').should('not.exist')
    })
  })

  describe('selectedIcon', function () {
    it('renders a selected icon if the prop is set', function () {
      render({
        defaultText: 'Choose an item',
        selectedIcon: true,
      })
      cy.findByText('Choose an item').click()
      cy.findByText('Demo item 1').click()
      cy.findByText('Demo item 1').click()

      cy.get('.fa-check').should('exist')
    })
    it('renders no selected icon if the prop is not set', function () {
      render({
        defaultText: 'Choose an item',
        selectedIcon: false,
      })
      cy.findByText('Choose an item').click()
      cy.findByText('Demo item 1').click()
      cy.findByText('Demo item 1').click()

      cy.get('.fa-check').should('not.exist')
    })
  })

  describe('itemToDisabled', function () {
    it('prevents selecting a disabled item', function () {
      render({
        defaultText: 'Choose an item',
        itemToDisabled: x => x?.key === 2,
      })
      cy.findByText('Choose an item').click()
      cy.findByText('Demo item 2').click()
      // still showing other list items
      cy.findByText('Demo item 3').should('exist')
      cy.findByText('Demo item 1').click()
      // clicking an enabled item dismisses the list
      cy.findByText('Demo item 3').should('not.exist')
    })
  })

  describe('selected', function () {
    it('shows the item provided in the selected prop', function () {
      render({
        defaultText: 'Choose an item',
        selected: testData[1],
      })
      cy.findByText('Demo item 2').should('exist')
    })

    it('should show default text when selected is null', function () {
      render({
        selected: null,
        defaultText: 'Choose an item',
      })
      cy.findByText('Choose an item').should('exist')
    })
  })
})
