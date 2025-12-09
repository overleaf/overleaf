import { Meta } from '@storybook/react'
import { OnlineUser } from '@/features/ide-react/context/online-users-context'
import OnlineUsersWidgetOld from '@/features/editor-navigation-toolbar/components/online-users-widget'
import { OnlineUsersWidget } from '@/features/ide-redesign/components/online-users/online-users-widget'

const NAMES = [
  'Alice',
  'Bob',
  'Charlie',
  'Dave',
  'Erin',
  'Frank',
  'Grace',
  'Heidi',
  'Ivan',
  'Judy',
  'Mallory',
  'Niaj',
  'Olivia',
  'Peggy',
  'Rupert',
]

const generateUser = (_: any, index: number): OnlineUser => {
  const name = NAMES[index % NAMES.length]
  return {
    user_id: `user_${'b'.repeat(index)}`,
    name,
    id: `user-${index}`,
    email: `${name.toLowerCase()}@example.com`,
  }
}

export const OnlineUsersRedesign = ({ users }: { users: number }) => {
  const generatedUsers = Array.from({ length: users }, generateUser)
  return (
    <div
      style={{
        backgroundColor: 'var(--online-users-border-color)',
        padding: '20px',
      }}
    >
      <OnlineUsersWidget
        onlineUsers={generatedUsers}
        goToUser={(async () => {}) as any}
      />
    </div>
  )
}

export const OnlineUsersOld = ({ users }: { users: number }) => {
  const generatedUsers = Array.from({ length: users }, generateUser)
  return (
    <div
      style={{
        backgroundColor: 'var(--online-users-border-color)',
        padding: '20px',
      }}
    >
      <OnlineUsersWidgetOld
        onlineUsers={generatedUsers}
        goToUser={(async () => {}) as any}
      />
    </div>
  )
}

const meta: Meta<typeof OnlineUsersRedesign> = {
  title: 'Editor / Online Users Widget',
  args: {
    users: 6,
  },
}

export default meta
