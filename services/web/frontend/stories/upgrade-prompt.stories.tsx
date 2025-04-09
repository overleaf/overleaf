import { UpgradePrompt } from '@/shared/components/upgrade-prompt'
import { StoryObj } from '@storybook/react/*'

type Story = StoryObj<typeof UpgradePrompt>

export const Generic: Story = {
  args: {
    title: 'Unlock more compile time',
    summary: 'Your project took too long to compile and timed out.',
    onClose: () => {},
    planPricing: { student: '$9', standard: '$21' },
    itmCampaign: 'storybook',
  },
}

export default {
  title: 'Shared / Components / Upgrade Prompt',
  component: UpgradePrompt,
}
