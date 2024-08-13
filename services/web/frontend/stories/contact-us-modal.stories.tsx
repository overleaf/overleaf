import { ComponentProps } from 'react'
import useFetchMock from './hooks/use-fetch-mock'
import ContactUsModal from '../../modules/support/frontend/js/components/contact-us-modal'
import { ScopeDecorator } from './decorators/scope'
import { StoryObj } from '@storybook/react'
import { FixedHelpSuggestionSearchProvider } from '../../modules/support/test/frontend/helpers/contact-us-modal-base-tests'

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
    <FixedHelpSuggestionSearchProvider>
      <ContactUsModal {...args} />
    </FixedHelpSuggestionSearchProvider>
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
    <FixedHelpSuggestionSearchProvider>
      <ContactUsModal {...args} />
    </FixedHelpSuggestionSearchProvider>
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
  },
}
