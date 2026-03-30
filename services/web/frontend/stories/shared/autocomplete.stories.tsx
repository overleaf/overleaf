import { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import OLAutocomplete from '@/shared/components/ol/ol-autocomplete'

type Args = React.ComponentProps<typeof OLAutocomplete>

const sampleItems = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'angular', label: 'Angular' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'ember', label: 'Ember' },
  { value: 'backbone', label: 'Backbone' },
  { value: 'preact', label: 'Preact' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'nuxtjs', label: 'Nuxt.js' },
  { value: 'gatsby', label: 'Gatsby' },
]

const programmingLanguages = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'dart', label: 'Dart' },
]

const countries = [
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'au', label: 'Australia' },
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
  { value: 'es', label: 'Spain' },
  { value: 'it', label: 'Italy' },
  { value: 'nl', label: 'Netherlands' },
  { value: 'be', label: 'Belgium' },
]

const entryTypeItems = [
  { value: 'article', label: 'Article', group: 'Most common' },
  { value: 'review', label: 'Review', group: 'Most common' },
  { value: 'book', label: 'Book', group: 'Most common' },
  { value: 'conference', label: 'Conference paper', group: 'Most common' },
  { value: 'thesis', label: 'Thesis', group: 'Most common' },
  { value: 'mastersthesis', label: "Master's thesis", group: 'Most common' },
  { value: 'phdthesis', label: 'PhD thesis', group: 'Most common' },
  { value: 'bookchapter', label: 'Book chapter', group: 'Book types' },
  { value: 'booksection', label: 'Book section', group: 'Book types' },
  { value: 'bookpart', label: 'Book part', group: 'Book types' },
  { value: 'editedbook', label: 'Edited book', group: 'Book types' },
  { value: 'referencebook', label: 'Reference book', group: 'Book types' },
  { value: 'proceedings', label: 'Conference proceedings', group: 'Other' },
  { value: 'journalarticle', label: 'Journal article', group: 'Other' },
  { value: 'techreport', label: 'Technical report', group: 'Other' },
  { value: 'preprint', label: 'Preprint', group: 'Other' },
  { value: 'patent', label: 'Patent', group: 'Other' },
  { value: 'manuscript', label: 'Manuscript', group: 'Other' },
  { value: 'unpublished', label: 'Unpublished', group: 'Other' },
]

function InteractiveAutocomplete(args: Args) {
  const [value, setValue] = useState('')

  return (
    <div style={{ maxWidth: '400px' }}>
      <OLAutocomplete {...args} onChange={setValue} />
      <div style={{ marginTop: '1rem' }}>
        <strong>Current value:</strong> {value || '(empty)'}
      </div>
    </div>
  )
}

export const Default: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: sampleItems,
    label: 'Select a framework',
    placeholder: 'Type to search...',
    showLabel: true,
    allowCreate: true,
  },
}

export const WithoutCreateOption: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: programmingLanguages,
    label: 'Programming language',
    placeholder: 'Choose a language',
    showLabel: true,
    allowCreate: false,
  },
}

export const AllowCreatePredicate: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: programmingLanguages,
    label: 'Programming language (custom rule)',
    placeholder: 'Try typing java or script',
    showLabel: true,
    allowCreate: value => {
      const normalized = value.trim().toLowerCase()
      return (
        normalized.length >= 4 &&
        !normalized.includes('script') &&
        normalized !== 'java'
      )
    },
  },
}

export const HiddenLabel: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: countries,
    label: 'Country',
    placeholder: 'Select your country',
    showLabel: false,
    allowCreate: true,
  },
}

export const CustomCreatePrefix: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: [
      { value: 'alpha', label: 'Project Alpha' },
      { value: 'beta', label: 'Project Beta' },
      { value: 'gamma', label: 'Project Gamma' },
    ],
    label: 'Project name',
    placeholder: 'Select or create a project',
    showLabel: true,
    allowCreate: true,
    createOptionPrefix: '➕ Create new project:',
  },
}

export const Disabled: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: sampleItems,
    label: 'Framework (disabled)',
    placeholder: 'Cannot interact',
    showLabel: true,
    disabled: true,
  },
}

export const SmallList: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
      { value: 'option3', label: 'Option 3' },
    ],
    label: 'Choose an option',
    placeholder: 'Type or select...',
    showLabel: true,
    allowCreate: true,
  },
}

export const GroupedItems: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: entryTypeItems,
    label: 'Entry type',
    placeholder: 'Enter entry type',
    showLabel: true,
    allowCreate: true,
  },
}

export const GroupedWithoutCreate: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: [
      { value: 'react', label: 'React', group: 'Frontend' },
      { value: 'vue', label: 'Vue', group: 'Frontend' },
      { value: 'angular', label: 'Angular', group: 'Frontend' },
      { value: 'svelte', label: 'Svelte', group: 'Frontend' },
      { value: 'nodejs', label: 'Node.js', group: 'Backend' },
      { value: 'django', label: 'Django', group: 'Backend' },
      { value: 'rails', label: 'Ruby on Rails', group: 'Backend' },
      { value: 'spring', label: 'Spring Boot', group: 'Backend' },
      { value: 'reactnative', label: 'React Native', group: 'Mobile' },
      { value: 'flutter', label: 'Flutter', group: 'Mobile' },
      { value: 'swift', label: 'Swift', group: 'Mobile' },
      { value: 'kotlin', label: 'Kotlin', group: 'Mobile' },
    ],
    label: 'Technology',
    placeholder: 'Search technologies...',
    showLabel: true,
    allowCreate: false,
  },
}

export const FuzzySearch: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: [
      { value: 'javascript', label: 'JavaScript' },
      { value: 'typescript', label: 'TypeScript' },
      { value: 'python', label: 'Python' },
      { value: 'rust', label: 'Rust' },
      { value: 'golang', label: 'Go' },
    ],
    label: 'Language (fuzzy search)',
    placeholder: 'Try typo searches, e.g. javasript or pyton',
    showLabel: true,
    allowCreate: true,
    useFuzzySearch: true,
  },
}

export const GroupedFuzzySearch: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: entryTypeItems,
    label: 'Grouped entry type (fuzzy search)',
    placeholder: 'Try typo searches, e.g. confernce or theis',
    showLabel: true,
    allowCreate: true,
    useFuzzySearch: true,
  },
}

export const ExpandUp: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: sampleItems,
    label: 'Framework (expand up)',
    placeholder: 'Dropdown expands upward',
    showLabel: true,
    allowCreate: true,
    expandUp: true,
  },
}

export const ExpandUpGrouped: StoryObj<Args> = {
  render: args => <InteractiveAutocomplete {...args} />,
  args: {
    items: entryTypeItems,
    label: 'Entry type (expand up)',
    placeholder: 'Grouped items expanding upward',
    showLabel: true,
    allowCreate: true,
    expandUp: true,
  },
}

const meta: Meta<typeof OLAutocomplete> = {
  title: 'Shared / Components / Autocomplete',
  component: OLAutocomplete,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: [
        'items',
        'label',
        'placeholder',
        'showLabel',
        'allowCreate',
        'disabled',
        'createOptionPrefix',
        'useFuzzySearch',
        'expandUp',
      ],
    },
  },
  argTypes: {
    items: {
      control: 'object',
      description:
        'Array of available options; use the optional group property for grouped sections',
    },
    onChange: {
      description: 'Callback when value changes',
    },
    label: {
      control: 'text',
      description: 'Label for the input',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    showLabel: {
      control: 'boolean',
      description: 'Show or hide the label visually',
    },
    allowCreate: {
      control: 'boolean',
      description:
        'Allow creating custom values, or provide a predicate function `(value) => boolean` to conditionally allow create per input value',
      table: {
        type: {
          summary: 'boolean | ((value: string) => boolean)',
        },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the input',
    },
    createOptionPrefix: {
      control: 'text',
      description: 'Text prefix for the create option',
    },
    useFuzzySearch: {
      control: 'boolean',
      description: 'Enable fuzzy search matching for suggestions',
    },
    expandUp: {
      control: 'boolean',
      description:
        'When true, the dropdown expands upward and the search bar appears below the results list',
    },
  },
}

export default meta
