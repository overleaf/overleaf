import DSNotification from '@/shared/components/ds/ds-notification'

type Args = React.ComponentProps<typeof DSNotification>

export const Notification = (args: Args) => {
  return <DSNotification {...args} />
}

export default {
  title: 'Shared / DS Components / Notification',
  component: DSNotification,
  args: {
    content: (
      <p>
        This can be <b>any HTML</b> passed to the component. For example,
        paragraphs, headers, <code>code samples</code>,{' '}
        <a href="/services/web/public">links</a>, etc are all supported.
      </p>
    ),
  },
  argTypes: {
    type: {
      control: 'radio',
      options: ['info', 'error'],
    },
  },
  parameters: {
    controls: {
      include: ['content', 'title', 'type'],
    },
  },
}
