import ToolbarHeader from '../js/features/editor-navigation-toolbar/components/toolbar-header'
import { ScopeDecorator } from './decorators/scope'

export const UpToThreeConnectedUsers = args => {
  return <ToolbarHeader {...args} />
}
UpToThreeConnectedUsers.args = {
  onlineUsers: ['a', 'c', 'd'].map(c => ({
    user_id: c,
    name: `${c}_user name`,
  })),
}

export const ManyConnectedUsers = args => {
  return <ToolbarHeader {...args} />
}
ManyConnectedUsers.args = {
  onlineUsers: ['a', 'c', 'd', 'e', 'f'].map(c => ({
    user_id: c,
    name: `${c}_user name`,
  })),
}

export default {
  title: 'Editor / Toolbar',
  component: ToolbarHeader,
  argTypes: {
    goToUser: { action: 'goToUser' },
    renameProject: { action: 'renameProject' },
    toggleHistoryOpen: { action: 'toggleHistoryOpen' },
    toggleReviewPanelOpen: { action: 'toggleReviewPanelOpen' },
    toggleChatOpen: { action: 'toggleChatOpen' },
    openShareModal: { action: 'openShareModal' },
    onShowLeftMenuClick: { action: 'onShowLeftMenuClick' },
  },
  args: {
    projectName: 'Overleaf Project',
    onlineUsers: [{ user_id: 'abc', name: 'overleaf' }],
    unreadMessageCount: 0,
  },
  decorators: [ScopeDecorator],
}
