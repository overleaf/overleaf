import { ComponentProps, useCallback, useState } from 'react'
import useFetchMock from './hooks/use-fetch-mock'
import ContactUsModal from '../../modules/support/frontend/js/components/contact-us-modal'
import fixedHelpSuggestionSearch from '../../modules/support/test/frontend/util/fixed-help-suggestion-search'
import { ScopeDecorator } from './decorators/scope'
import { StoryObj } from '@storybook/react'
import OLButton from '@/features/ui/components/ol/ol-button'
import { bsVersionDecorator } from '../../.storybook/utils/with-bootstrap-switcher'

type Story = StoryObj<typeof ContactUsModal>
type ContactUsModalProps = ComponentProps<typeof ContactUsModal>

function bootstrap3Story(render: Story['render']): Story {
  return {
    render,
    decorators: [
      story => {
        return ScopeDecorator(story)
      },
    ],
  }
}

function bootstrap5Story(render: Story['render']): Story {
  return {
    render,
    decorators: [
      story => {
        return ScopeDecorator(story, undefined, {
          'ol-bootstrapVersion': 5,
        })
      },
    ],
    parameters: {
      bootstrap5: true,
    },
  }
}

function GenericContactUsModal(args: ContactUsModalProps) {
  useFetchMock(fetchMock => {
    fetchMock.post('/support', { status: 200 }, { delay: 1000 })
  })

  return (
    <ContactUsModal
      helpSuggestionSearch={fixedHelpSuggestionSearch}
      {...args}
    />
  )
}

export const Generic: Story = bootstrap3Story(args => (
  <GenericContactUsModal {...args} />
))

export const GenericBootstrap5: Story = bootstrap5Story(args => (
  <GenericContactUsModal {...args} />
))

const ContactUsModalWithRequestError = (args: ContactUsModalProps) => {
  useFetchMock(fetchMock => {
    fetchMock.post('/support', { status: 404 }, { delay: 250 })
  })

  return (
    <ContactUsModal
      helpSuggestionSearch={fixedHelpSuggestionSearch}
      {...args}
    />
  )
}

const renderContactUsModalWithRequestError = (args: ContactUsModalProps) => (
  <ContactUsModalWithRequestError {...args} />
)

export const RequestError: Story = bootstrap3Story(
  renderContactUsModalWithRequestError
)

export const RequestErrorBootstrap5: Story = bootstrap5Story(
  renderContactUsModalWithRequestError
)

const ContactUsModalWithAcknowledgement = (
  args: Omit<ContactUsModalProps, 'show' | 'handleHide'>
) => {
  useFetchMock(fetchMock => {
    fetchMock.post('/support', { status: 200 }, { delay: 1000 })
  })

  const [show, setShow] = useState(false)

  const hideModal = useCallback((event?: Event) => {
    event?.preventDefault()
    setShow(false)
  }, [])

  return (
    <>
      <OLButton onClick={() => setShow(true)}>Contact Us</OLButton>
      <ContactUsModal
        show={show}
        handleHide={hideModal}
        helpSuggestionSearch={fixedHelpSuggestionSearch}
        {...args}
      />
    </>
  )
}

const renderContactUsModalWithAcknowledgement = (args: ContactUsModalProps) => {
  const { show, handleHide, ...rest } = args
  return <ContactUsModalWithAcknowledgement {...rest} />
}

export const WithAcknowledgement: Story = bootstrap3Story(
  renderContactUsModalWithAcknowledgement
)

export const WithAcknowledgementBootstrap5: Story = bootstrap5Story(
  renderContactUsModalWithAcknowledgement
)

export default {
  title: 'Shared / Modals / Contact Us',
  component: ContactUsModal,
  args: {
    show: true,
    handleHide: () => {},
    autofillProjectUrl: true,
  },
  argTypes: {
    handleHide: { action: 'close modal' },
    ...bsVersionDecorator.argTypes,
  },
}
