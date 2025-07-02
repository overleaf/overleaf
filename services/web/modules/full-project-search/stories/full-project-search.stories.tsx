import { Meta, StoryObj } from '@storybook/react'
import { ScopeDecorator } from '../../../frontend/stories/decorators/scope'
import useFetchMock from '../../../frontend/stories/hooks/use-fetch-mock'
import FullProjectSearchUI from '../frontend/js/components/full-project-search-ui'

const meta = {
  title: 'Editor / Full Project Search',
  component: FullProjectSearchUI,
  decorators: [
    Story => ScopeDecorator(Story, { mockCompileOnLoad: true }),
    Story => {
      useFetchMock(fetchMock => {
        fetchMock.post('express:/project/:projectId/flush', { status: 204 })

        fetchMock.get('express:/project/:projectId/latest/history', {
          status: 200,
          body: {
            chunk: {
              history: {
                snapshot: {
                  files: {},
                },
                changes: [
                  {
                    operations: [
                      {
                        pathname: 'main.tex',
                        file: {
                          hash: '5199b66d9d1226551be436c66bad9d962cc05537',
                          stringLength: 7066,
                        },
                      },
                    ],
                    timestamp: '2025-01-03T10:10:40.840Z',
                    authors: [],
                    v2Authors: ['66e040e0da7136ec75ffe8a3'],
                    projectVersion: '1.0',
                  },
                  {
                    operations: [
                      {
                        pathname: 'sample.bib',
                        file: {
                          hash: 'a0e21c740cf81e868f158e30e88985b5ea1d6c19',
                          stringLength: 244,
                        },
                      },
                    ],
                    timestamp: '2025-01-03T10:10:40.856Z',
                    authors: [],
                    v2Authors: ['66e040e0da7136ec75ffe8a3'],
                    projectVersion: '2.0',
                  },
                  {
                    operations: [
                      {
                        pathname: 'frog.jpg',
                        file: {
                          hash: '5b889ef3cf71c83a4c027c4e4dc3d1a106b27809',
                          byteLength: 97080,
                        },
                      },
                    ],
                    timestamp: '2025-01-03T10:10:40.890Z',
                    authors: [],
                    v2Authors: ['66e040e0da7136ec75ffe8a3'],
                    projectVersion: '3.0',
                  },
                ],
              },
              startVersion: 0,
            },
          },
        })

        fetchMock.get('express:/project/:projectId/changes', {
          status: 200,
          body: [],
        })

        fetchMock.get(
          'express:/project/:projectId/blob/5199b66d9d1226551be436c66bad9d962cc05537',
          {
            status: 200,
            body: `Simply use the section and subsection commands, as in this example document! With Overleaf, all the formatting and numbering is handled automatically according to the template you've chosen. If you're using the Visual Editor, you can also create new section and subsections via the buttons in the editor toolbar.`,
          }
        )

        fetchMock.get(
          'express:/project/:projectId/blob/a0e21c740cf81e868f158e30e88985b5ea1d6c19',
          {
            status: 200,
            body: `@article{greenwade93,
    author  = "George D. Greenwade",
    title   = "The {C}omprehensive {T}ex {A}rchive {N}etwork ({CTAN})",
    year    = "1993",
    journal = "TUGBoat",
    volume  = "14",
    number  = "3",
    pages   = "342--351"
}`,
          }
        )
      })
      return <Story />
    },
  ],
} satisfies Meta<typeof FullProjectSearchUI>

export default meta
type Story = StoryObj<typeof FullProjectSearchUI>

export const UI = {} satisfies Story
