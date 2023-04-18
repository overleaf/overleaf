import Badge from '../js/shared/components/badge'
import Icon from '../js/shared/components/icon'

type Args = React.ComponentProps<typeof Badge>

export const NewBadge = (args: Args) => {
  return <Badge {...args} />
}

export const NewBadgePrepend = (args: Args) => {
  return <Badge prepend={<Icon type="tag" fw />} {...args} />
}

export const NewBadgeWithCloseButton = (args: Args) => {
  return (
    <Badge
      prepend={<Icon type="tag" fw />}
      closeButton
      onClose={() => alert('Close triggered!')}
      {...args}
    />
  )
}

export default {
  title: 'Shared / Components / Badge',
  component: Badge,
  args: {
    children: 'content',
  },
  argTypes: {
    prepend: {
      table: {
        disable: true,
      },
    },
    closeButton: {
      table: {
        disable: true,
      },
    },
    onClose: {
      table: {
        disable: true,
      },
    },
    closeBtnProps: {
      table: {
        disable: true,
      },
    },
  },
}
