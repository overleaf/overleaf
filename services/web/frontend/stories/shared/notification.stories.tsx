import fetchMock from 'fetch-mock'
import Notification from '../../js/shared/components/notification'
import { postJSON } from '../../js/infrastructure/fetch-json'
import useAsync from '../../js/shared/hooks/use-async'
import { figmaDesignUrl } from '../../../.storybook/utils/figma-design-url'

type Args = React.ComponentProps<typeof Notification>

export const NotificationInfo = (args: Args) => {
  return <Notification {...args} isDismissible />
}
NotificationInfo.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3488-103958&m=dev'
)

export const NotificationSuccess = (args: Args) => {
  return <Notification {...args} isDismissible type="success" />
}
NotificationSuccess.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-110077&m=dev'
)

export const NotificationWarning = (args: Args) => {
  return <Notification {...args} isDismissible type="warning" />
}
NotificationWarning.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-112036&m=dev'
)

export const NotificationError = (args: Args) => {
  return <Notification {...args} isDismissible type="error" />
}
NotificationError.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-112059&m=dev'
)

export const NotificationOffer = (args: Args) => {
  return <Notification {...args} isDismissible type="offer" />
}

export const NotificationWithActionBelowContent = (args: Args) => {
  return (
    <Notification
      {...args}
      content={
        <div>
          <p>The CTA will always go below the content on small screens.</p>
          <p>
            We can also opt to always put the CTA below the content on all
            screens
          </p>
        </div>
      }
      isDismissible
      isActionBelowContent
    />
  )
}
NotificationWithActionBelowContent.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-118816&m=dev'
)

export const NotificationWithTitle = (args: Args) => {
  return <Notification {...args} title="Some title" />
}
NotificationWithTitle.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-115045&m=dev'
)

export const NotificationWithAction = (args: Args) => {
  return <Notification {...args} isDismissible={false} />
}
NotificationWithAction.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-117190&m=dev'
)

export const NotificationDismissible = (args: Args) => {
  return <Notification {...args} action={undefined} />
}
NotificationDismissible.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-116677&m=dev'
)

export const APlainNotification = (args: Args) => {
  return <Notification {...args} action={undefined} isDismissible={false} />
}

export const NotificationWithMultipleParagraphsAndActionAndDismissible = (
  args: Args
) => {
  return (
    <Notification
      {...args}
      content={
        <div>
          <p>
            <b>Lorem ipsum</b>
          </p>
          <p>
            Dolor sit amet, consectetur adipiscing elit. Proin lacus velit,
            faucibus vitae feugiat sit amet, <a href="/">Some link</a> iaculis
            ut mi.
          </p>
          <p>
            Vel eros donec ac odio tempor orci dapibus ultrices in. Fermentum
            iaculis eu non diam phasellus.
          </p>
          <p>Aliquam at tempor risus. Vestibulum bibendum ut </p>
        </div>
      }
    />
  )
}

export const NotificationWithMultipleParagraphsAndDismissible = (
  args: Args
) => {
  return (
    <Notification
      {...args}
      action={undefined}
      content={
        <div>
          <p>
            <b>Lorem ipsum</b>
          </p>
          <p>
            Dolor sit amet, consectetur adipiscing elit. Proin lacus velit,
            faucibus vitae feugiat sit amet, <a href="/">Some link</a> iaculis
            ut mi.
          </p>
          <p>
            Vel eros donec ac odio tempor orci dapibus ultrices in. Fermentum
            iaculis eu non diam phasellus.
          </p>
          <p>Aliquam at tempor risus. Vestibulum bibendum ut </p>
        </div>
      }
    />
  )
}

export const MultipleParagraphsAndAction = (args: Args) => {
  return (
    <Notification
      {...args}
      isDismissible={false}
      content={
        <div>
          <p>
            <b>Lorem ipsum</b>
          </p>
          <p>
            Dolor sit amet, consectetur adipiscing elit. Proin lacus velit,
            faucibus vitae feugiat sit amet, <a href="/">Some link</a> iaculis
            ut mi.
          </p>
          <p>
            Vel eros donec ac odio tempor orci dapibus ultrices in. Fermentum
            iaculis eu non diam phasellus.
          </p>
          <p>Aliquam at tempor risus. Vestibulum bibendum ut </p>
        </div>
      }
    />
  )
}

export const MultipleParagraphs = (args: Args) => {
  return (
    <Notification
      {...args}
      action={undefined}
      isDismissible={false}
      content={
        <div>
          <p>
            <b>Lorem ipsum</b>
          </p>
          <p>
            Dolor sit amet, consectetur adipiscing elit. Proin lacus velit,
            faucibus vitae feugiat sit amet, <a href="/">Some link</a> iaculis
            ut mi.
          </p>
          <p>
            Vel eros donec ac odio tempor orci dapibus ultrices in. Fermentum
            iaculis eu non diam phasellus.
          </p>
          <p>Aliquam at tempor risus. Vestibulum bibendum ut </p>
        </div>
      }
    />
  )
}

export const ShortText = (args: Args) => {
  return (
    <Notification
      {...args}
      action={undefined}
      isDismissible={false}
      content={<p>Lorem ipsum</p>}
    />
  )
}

export const ShortTextAndDismissible = (args: Args) => {
  return (
    <Notification {...args} action={undefined} content={<p>Lorem ipsum</p>} />
  )
}

export const ShortTextAndActionLinkAsButton = (args: Args) => {
  return (
    <Notification
      {...args}
      isDismissible={false}
      content={<p>Lorem ipsum</p>}
    />
  )
}

export const ShortTextAndActionAsLink = (args: Args) => {
  return (
    <Notification
      {...args}
      content={<p>Lorem ipsum</p>}
      action={<a href="/">An action</a>}
      isDismissible={false}
    />
  )
}
export const ShortTextAndActionAsLinkButStyledAsButton = (args: Args) => {
  return (
    <Notification
      {...args}
      content={<p>Lorem ipsum</p>}
      action={
        <a href="/" className="btn btn-secondary">
          An action
        </a>
      }
      isDismissible={false}
    />
  )
}

export const LongActionButton = (args: Args) => {
  return (
    <Notification
      {...args}
      action={
        <button className="btn btn-secondary">
          Action that has a lot of text
        </button>
      }
    />
  )
}

export const LongActionLink = (args: Args) => {
  return (
    <Notification
      {...args}
      action={<a href="/">Action that has a lot of text</a>}
    />
  )
}

export const CustomIcon = (args: Args) => {
  return (
    <Notification
      {...args}
      customIcon={<div style={{ marginTop: '-4px' }}>🎉</div>}
    />
  )
}

export const MultipleButtons = (args: Args) => {
  return (
    <Notification
      {...args}
      content={<p>Lorem ipsum</p>}
      action={
        <>
          <button className="btn btn-secondary">button1</button>
          <button className="btn btn-secondary">button2</button>
        </>
      }
      type="info"
      isActionBelowContent
      isDismissible
    />
  )
}

export const OverlayedWithCustomClass = (args: Args) => {
  return (
    <>
      <Notification
        {...args}
        content={
          <p>
            This can be <b>any HTML</b> passed to the component. For example,
            paragraphs, headers, <code>code samples</code>,{' '}
            <a href="/">links</a>, etc are all supported.
          </p>
        }
        className="ol-overlay"
        action={
          <>
            <button className="btn btn-secondary">button1</button>
            <button className="btn btn-secondary">button2</button>
          </>
        }
        type="info"
        isActionBelowContent
        isDismissible
      />
      <div>
        <p>we need filler content, so here are some jokes</p>
        <ul>
          <li>Did you hear about the circus fire? It was in tents!</li>
          <li>How do you catch a squirrel? Climb a tree and act like a nut!</li>
          <li>
            Did you hear about the guy who invented Lifesavers? They say he made
            a mint!
          </li>
          <li>
            Why couldn't the bicycle stand up by itself? It was two tired.
          </li>
          <li>
            did one hat say to the other?" "Stay here! I'm going on ahead.
          </li>
          <li>
            Why did Billy get fired from the banana factory? He kept throwing
            away the bent ones.
          </li>
        </ul>
      </div>
    </>
  )
}

export const SuccessFlow = (args: Args) => {
  console.log('.....render')
  fetchMock.post('express:/test-success', { status: 200 }, { delay: 250 })

  const { isLoading, isSuccess, runAsync } = useAsync()
  function handleClick() {
    console.log('clicked')
    runAsync(postJSON('/test-success')).catch(console.error)
  }

  const ctaText = isLoading ? 'Processing' : 'Click'
  const action = (
    <button
      className="btn btn-secondary"
      onClick={() => handleClick()}
      disabled={isLoading}
    >
      {ctaText}
    </button>
  )

  const startNotification = (
    <Notification
      {...args}
      action={action}
      title="An example notification flow"
      content={
        <p>
          This story shows 2 notifications, and it's up to the parent component
          to determine which to show. There's a successful request made after
          clicking the action and so the parent component then renders the
          success notification.
        </p>
      }
    />
  )
  const successNotification = (
    <Notification
      {...args}
      action={<a href="/">Now follow this link to go home</a>}
      type="success"
      content={<p>Success! You made a successful request.</p>}
    />
  )

  if (isSuccess) return successNotification
  return startNotification
}

export const ContentAsAString = (args: Args) => {
  return <Notification {...args} content="An alert" />
}

export default {
  title: 'Shared / Components / Notification',
  component: Notification,
  args: {
    content: (
      <p>
        This can be <b>any HTML</b> passed to the component. For example,
        paragraphs, headers, <code>code samples</code>, <a href="/">links</a>,
        etc are all supported.
      </p>
    ),
    action: <button className="btn btn-secondary">An action</button>,
    isDismissible: true,
    title: undefined,
  },
  argTypes: {
    content: {
      control: 'text',
    },
    action: {
      control: 'text',
    },
    title: {
      control: 'text',
    },
  },
  parameters: {
    controls: {
      include: [
        'content',
        'title',
        'action',
        'ariaLive',
        'type',
        'isDismissible',
        'isActionBelowContent',
      ],
    },
  },
}
