import SourceEditor from '../../js/features/source-editor/components/source-editor'
import { ScopeDecorator } from '../decorators/scope'
import { useScope } from '../hooks/use-scope'
import { useMeta } from '../hooks/use-meta'
import { FC } from 'react'
import { FileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import RangesTracker from '@overleaf/ranges-tracker'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

const FileTreePathProvider: FC = ({ children }) => (
  <FileTreePathContext.Provider
    value={{
      dirname: () => null,
      findEntityByPath: () => null,
      pathInFolder: () => null,
      previewByPath: (path: string) =>
        path === 'frog.jpg'
          ? {
              extension: 'png',
              url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9TpaJVETuIOGSogmBBVMRRq1CECqFWaNXB5NIvaNKQpLg4Cq4FBz8Wqw4uzro6uAqC4AeIq4uToouU+L+k0CLWg+N+vLv3uHsHCNUi06y2cUDTbTMRi4qp9KoYeIWAPnShB6Mys4w5SYqj5fi6h4+vdxGe1frcn6NbzVgM8InEs8wwbeIN4ulN2+C8TxxieVklPiceM+mCxI9cVzx+45xzWeCZITOZmCcOEYu5JlaamOVNjXiKOKxqOuULKY9VzluctWKZ1e/JXxjM6CvLXKc5hBgWsQQJIhSUUUARNiK06qRYSNB+tIV/0PVL5FLIVQAjxwJK0CC7fvA/+N2tlZ2c8JKCUaD9xXE+hoHALlCrOM73sePUTgD/M3ClN/ylKjDzSXqloYWPgN5t4OK6oSl7wOUOMPBkyKbsSn6aQjYLvJ/RN6WB/lugc83rrb6P0wcgSV3Fb4CDQ2AkR9nrLd7d0dzbv2fq/f0ARfNylZJUgMQAAAAGYktHRABuAP8AAGHZRr4AAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfnAhELEhgyPeVkAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAyVJREFUeNrt1rEJgDAURVGVNCmS2hS6PziCteIYWjuEbiEfOWeEV1xe35bt6QhjnlYjBJLzbYRABhMAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBYgWACCBSBYgGABCBaAYAGCBSBYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFiBYAIIFIFiAYAEIFoBgAYIFIFgAggUIFoBgAQgWIFgAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBYgWACCBSBYgGABCBYgWACCBSBYgGABCBaAYAGCBSBYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFoBgAYIFIFgAggUIFoBgAQgWIFgAggUgWIBgAQgWIFgAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBbwX6m13QqB5HwbIZBSLyN4WACCBQgWgGABCBYgWACCBSBYgGABCBaAYAGCBSBYAIIFCBaAYAEIFiBYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFoBgAYIFIFgAggUIFoBgAQgWIFgAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBYgWACCBQgWgGABCBYgWACCBSBYgGABCBaAYAGCBSBYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFoBgAYIFIFgAggUIFoBgAQgWIFgAggUIFoBgAQgWIFgAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBYgWACCBSBYgGABCBaAYAGCBfCFVMtphUBKvYwQSBsPI3hYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFoBgAYIFIFgAggUIFoBgAQgWIFgAggUIFoBgAQgWIFgAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBYgWACCBSBYgGABCBaAYAGCBSBYAIIFCBaAYAEIFiBYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFoBgAYIFIFgAggUIFoBgAQgWIFgAggUgWIBgAQgWgGABggUgWACCBQgWgGABCBYgWACCBQgWgGABCBYgWACCBSBYgGABCBaAYAGCBSBYAIIFCBaAYAEIFiBYAIIFIFiAYAEIFoBgAYIF8IUXjtUMuBMh1xAAAAAASUVORK5CYII=',
            }
          : null,
    }}
  >
    {children}
  </FileTreePathContext.Provider>
)

export default {
  title: 'Editor / Source Editor',
  component: SourceEditor,
  decorators: [
    (Story: any) =>
      ScopeDecorator(Story, {
        mockCompileOnLoad: true,
        providers: { FileTreePathProvider },
      }),
    (Story: any) => (
      <div style={{ height: '90vh' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}

const settings = {
  fontSize: 12,
  fontFamily: 'monaco',
  lineHeight: 'normal',
  editorTheme: 'textmate',
  overallTheme: '',
  mode: 'default',
  autoComplete: true,
  autoPairDelimiters: true,
  trackChanges: true,
  syntaxValidation: false,
}

const reviewPanel = {
  resolvedComments: {},
  formattedProjectMembers: {},
  overview: { docsCollapsedState: { 'story-doc': false } },
  entries: {},
}

const permissions = {
  write: true,
}

export const Latex = (args: any, { globals: { theme } }: any) => {
  // FIXME: useScope has no effect
  useScope({
    editor: {
      sharejs_doc: mockDoc(content.tex, changes.tex),
      open_doc_name: 'example.tex',
    },
    rootFolder: {
      name: 'rootFolder',
      id: 'root-folder-id',
      type: 'folder',
      children: [
        {
          name: 'example.tex.tex',
          id: 'example-doc-id',
          type: 'doc',
          selected: false,
          $$hashKey: 'object:89',
        },
        {
          name: 'frog.jpg',
          id: 'frog-image-id',
          type: 'file',
          linkedFileData: null,
          created: '2023-05-04T16:11:04.352Z',
          $$hashKey: 'object:108',
        },
      ],
      selected: false,
    },
    settings: {
      ...settings,
      overallTheme: theme === 'default-' ? '' : theme,
    },
    permissions,
    reviewPanel,
  })

  useMeta({
    'ol-showSymbolPalette': true,
  })

  return <SourceEditor />
}

export const Markdown = (args: any, { globals: { theme } }: any) => {
  useScope({
    editor: {
      sharejs_doc: mockDoc(content.md, changes.md),
      open_doc_name: 'example.md',
    },
    settings: {
      ...settings,
      overallTheme: theme === 'default-' ? '' : theme,
    },
    permissions,
    reviewPanel,
  })

  return <SourceEditor />
}

export const Visual = (args: any, { globals: { theme } }: any) => {
  useScope({
    editor: {
      sharejs_doc: mockDoc(content.tex, changes.tex),
      open_doc_name: 'example.tex',
      showVisual: true,
    },
    settings: {
      ...settings,
      overallTheme: theme === 'default-' ? '' : theme,
    },
    permissions,
    reviewPanel,
  })
  useMeta({
    'ol-showSymbolPalette': true,
    'ol-mathJaxPath': 'https://unpkg.com/mathjax@3.2.2/es5/tex-svg-full.js',
    'ol-project_id': '63e21c07946dd8c76505f85a',
  })

  return <SourceEditor />
}

export const Bibtex = (args: any, { globals: { theme } }: any) => {
  useScope({
    editor: {
      sharejs_doc: mockDoc(content.bib, changes.bib),
      open_doc_name: 'example.bib',
    },
    settings: {
      ...settings,
      overallTheme: theme === 'default-' ? '' : theme,
    },
    permissions,
    reviewPanel,
  })

  return <SourceEditor />
}

const MAX_DOC_LENGTH = 2 * 1024 * 1024 // ol-maxDocLength

const mockDoc = (content: string, changes: Array<Record<string, any>> = []) => {
  const mockShareJSDoc = {
    getText() {
      return content
    },
    on() {
      // do nothing
    },
    insert() {
      // do nothing
    },
    del() {
      // do nothing
    },
    emit: (...args: any[]) => {
      console.log(...args)
    },
  }

  return {
    doc_id: 'story-doc',
    getSnapshot: () => {
      return content
    },
    attachToCM6: (cm6: any) => {
      cm6.attachShareJs(mockShareJSDoc, MAX_DOC_LENGTH)
    },
    detachFromCM6: () => {
      // Do nothing
    },
    on: () => {
      // Do nothing
    },
    off: () => {
      // Do nothing
    },
    setTrackChangesIdSeeds: () => {
      // Do nothing
    },
    setTrackingChanges: () => {
      // Do nothing
    },
    getTrackingChanges: () => {
      return true
    },
    getInflightOp: () => {
      return null
    },
    getPendingOp: () => {
      return null
    },
    ranges: new RangesTracker(changes, []),
  }
}

const changes: Record<string, Array<Record<string, any>>> = {
  tex: [
    {
      id: '1',
      op: {
        i: 'Your introduction goes here! Simply start writing your document and use the Recompile button to view the updated PDF preview. Examples of commonly used commands and features are listed below, to help you get started.',
        p: 583,
      },
      meta: {
        user_id: '1',
        ts: new Date().toString(),
      },
    },
  ],
  md: [],
  bib: [],
}

const content = {
  tex: `\\documentclass{article}

% Language setting
% Replace \`english' with e.g. \`spanish' to change the document language
\\usepackage[english]{babel}

% Set page size and margins
% Replace \`letterpaper' with \`a4paper' for UK/EU standard size
\\usepackage[letterpaper,top=2cm,bottom=2cm,left=3cm,right=3cm,marginparwidth=1.75cm]{geometry}

% Useful packages
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage[colorlinks=true, allcolors=blue]{hyperref}

\\title{Your Paper}
\\author{You}

\\begin{document}
\\maketitle

\\begin{abstract}
Your abstract.
\\end{abstract}

\\section{Introduction}

Your introduction goes here! Simply start writing your document and use the Recompile button to view the updated PDF preview. Examples of commonly used commands and features are listed below, to help you get started.

Once you're familiar with the editor, you can find various project settings in the Overleaf menu, accessed via the button in the very top left of the editor. To view tutorials, user guides, and further documentation, please visit our \\href{https://www.overleaf.com/learn}{help library}, or head to our plans page to \\href{https://www.overleaf.com/user/subscription/plans}{choose your plan}.

\\section{Some examples to get started}

\\subsection{How to create Sections and Subsections}

Simply use the section and subsection commands, as in this example document! With Overleaf, all the formatting and numbering is handled automatically according to the template you've chosen. If you're using Rich Text mode, you can also create new section and subsections via the buttons in the editor toolbar.

\\subsection{How to include Figures}

First you have to upload the image file from your computer using the upload link in the file-tree menu. Then use the includegraphics command to include it in your document. Use the figure environment and the caption command to add a number and a caption to your figure. See the code for Figure \\ref{fig:frog} in this section for an example.

Note that your figure will automatically be placed in the most appropriate place for it, given the surrounding text and taking into account other figures or tables that may be close by. You can find out more about adding images to your documents in this help article on \\href{https://www.overleaf.com/learn/how-to/Including_images_on_Overleaf}{including images on Overleaf}.

\\begin{figure}
\\centering
\\includegraphics[width=0.25\\linewidth]{frog.jpg}
\\caption{This frog was uploaded via the file-tree menu.}\\label{fig:frog}
\\end{figure}

\\subsection{How to add Tables}

Use the table and tabular environments for basic tables --- see Table~\\ref{tab:widgets}, for example. For more information, please see this help article on \\href{https://www.overleaf.com/learn/latex/tables}{tables}.

\\begin{table}
\\centering
\\begin{tabular}{l|r}
Item & Quantity \\\\\\hline
Widgets & 42 \\\\
Gadgets & 13
\\end{tabular}
\\caption{\\label{tab:widgets}An example table.}
\\end{table}

\\subsection{How to add Comments and Track Changes}

Comments can be added to your project by highlighting some text and clicking \`\`Add comment'' in the top right of the editor pane. To view existing comments, click on the Review menu in the toolbar above. To reply to a comment, click on the Reply button in the lower right corner of the comment. You can close the Review pane by clicking its name on the toolbar when you're done reviewing for the time being.

Track changes are available on all our \\href{https://www.overleaf.com/user/subscription/plans}{premium plans}, and can be toggled on or off using the option at the top of the Review pane. Track changes allow you to keep track of every change made to the document, along with the person making the change.

\\subsection{How to add Lists}

You can make lists with automatic numbering \\dots

\\begin{enumerate}
\\item Like this,
\\item and like this.
\\end{enumerate}
\\dots or bullet points \\dots
\\begin{itemize}
\\item Like this,
\\item and like this.
\\end{itemize}

\\subsection{How to write Mathematics}

\\LaTeX{} is great at typesetting mathematics. Let $X_1, X_2, \\ldots, X_n$ be a sequence of independent and identically distributed random variables with $\\text{E}[X_i] = \\mu$ and $\\text{Var}[X_i] = \\sigma^2 < \\infty$, and let
\\[S_n = \\frac{X_1 + X_2 + \\cdots + X_n}{n}
      = \\frac{1}{n}\\sum_{i}^{n} X_i\\]
denote their mean. Then as $n$ approaches infinity, the random variables $\\sqrt{n}(S_n - \\mu)$ converge in distribution to a normal $\\mathcal{N}(0, \\sigma^2)$.


\\subsection{How to change the margins and paper size}

Usually the template you're using will have the page margins and paper size set correctly for that use-case. For example, if you're using a journal article template provided by the journal publisher, that template will be formatted according to their requirements. In these cases, it's best not to alter the margins directly.

If however you're using a more general template, such as this one, and would like to alter the margins, a common way to do so is via the geometry package. You can find the geometry package loaded in the preamble at the top of this example file, and if you'd like to learn more about how to adjust the settings, please visit this help article on \\href{https://www.overleaf.com/learn/latex/page_size_and_margins}{page size and margins}.

\\subsection{How to change the document language and spell check settings}

Overleaf supports many different languages, including multiple different languages within one document.

To configure the document language, simply edit the option provided to the babel package in the preamble at the top of this example project. To learn more about the different options, please visit this help article on \\href{https://www.overleaf.com/learn/latex/International_language_support}{international language support}.

To change the spell check language, simply open the Overleaf menu at the top left of the editor window, scroll down to the spell check setting, and adjust accordingly.

\\subsection{How to add Citations and a References List}

You can simply upload a \\verb|.bib| file containing your BibTeX entries, created with a tool such as JabRef. You can then cite entries from it, like this: \\cite{greenwade93}. Just remember to specify a bibliography style, as well as the filename of the \\verb|.bib|. You can find a \\href{https://www.overleaf.com/help/97-how-to-include-a-bibliography-using-bibtex}{video tutorial here} to learn more about BibTeX.

If you have an \\href{https://www.overleaf.com/user/subscription/plans}{upgraded account}, you can also import your Mendeley or Zotero library directly as a \\verb|.bib| file, via the upload menu in the file-tree.

\\subsection{Good luck!}

We hope you find Overleaf useful, and do take a look at our \\href{https://www.overleaf.com/learn}{help library} for more tutorials and user guides! Please also let us know if you have any feedback using the Contact Us link at the bottom of the Overleaf menu --- or use the contact form at \\url{https://www.overleaf.com/contact}.

\\bibliographystyle{alpha}
\\bibliography{sample}

\\end{document}`,
  md: `# Heading

This is **bold**

This is _italic_`,
  bib: `@book{texbook,
  author = {Donald E. Knuth},
  year = {1986},
  title = {The {\\TeX} Book},
  publisher = {Addison-Wesley Professional}
}

@book{latex:companion,
  author = {Frank Mittelbach and Michel Gossens
            and Johannes Braams and David Carlisle
            and Chris Rowley},
  year = {2004},
  title = {The {\\LaTeX} Companion},
  publisher = {Addison-Wesley Professional},
  edition = {2}
}

@book{latex2e,
  author = {Leslie Lamport},
  year = {1994},
  title = {{\\LaTeX}: a Document Preparation System},
  publisher = {Addison Wesley},
  address = {Massachusetts},
  edition = {2}
}

@article{knuth:1984,
  title={Literate Programming},
  author={Donald E. Knuth},
  journal={The Computer Journal},
  volume={27},
  number={2},
  pages={97--111},
  year={1984},
  publisher={Oxford University Press}
}

@inproceedings{lesk:1977,
  title={Computer Typesetting of Technical Journals on {UNIX}},
  author={Michael Lesk and Brian Kernighan},
  booktitle={Proceedings of American Federation of
              Information Processing Societies: 1977
              National Computer Conference},
  pages={879--888},
  year={1977},
  address={Dallas, Texas}
}
`,
}
