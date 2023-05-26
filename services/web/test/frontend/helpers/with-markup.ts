import { MatcherFunction } from '@testing-library/react'

type Query = (f: MatcherFunction) => Element | Promise<Element>

/*
 Utility function to run testing-library queries over nodes that contain html tags, as in
 `<p>this includes some <strong>bold</strong> text</p>`.

 Usage:
    const getByTextWithMarkup = withMarkup(screen.getByText)
    getByTextWithMarkup('this includes some bold text')

    const findByTextWithMarkup = withMarkup(screen.findByText)
    await findByTextWithMarkup('this includes some bold text')
 */
const withMarkup =
  (query: Query) =>
  (text: string): Element | Promise<Element> =>
    query((content: string, node: Element | null) => {
      if (!node) {
        return false
      }
      const hasText = (node: Element) => node.textContent === text
      const childrenDontHaveText = Array.from(node.children).every(
        child => !hasText(child as HTMLElement)
      )
      return hasText(node) && childrenDontHaveText
    })

export default withMarkup
