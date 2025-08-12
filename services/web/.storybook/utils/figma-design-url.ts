/** Creates design parameters for a Storybook story conditionally.
 * Helper function to generate design parameters based on the presence of a Figma access token.
 * The benefit of the token is that it allows component inspection directly in Storybook.
 * If token is not available, it defaults to a basic Figma URL.
 * Token can be generated in your Figma account settings.
 * To copy URL: In your Figma file, click to select the specific component frame you want to display in Storybook.
 * It's important to select the outer frame of the component, not just a single layer inside it.
 */

export const figmaDesignUrl = (url: string) => {
  const accessToken = process.env.STORYBOOK_FIGMA_ACCESS_TOKEN

  const designConfig = accessToken
    ? { type: 'figspec', url, accessToken }
    : { type: 'figma', url }

  return {
    design: designConfig,
  }
}
