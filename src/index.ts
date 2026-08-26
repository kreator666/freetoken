import { RealseeConsumer } from './services/realsee/consumer.js'
import { ImageConsumer } from './services/image/consumer.js'
import { realseeTools } from './tools/realsee.tool.js'
import { imageTools } from './tools/image.tool.js'

export { RealseeConsumer, ImageConsumer, realseeTools, imageTools }
export * from './types.js'

/**
 * Minimal standalone context factory.
 * When loaded as a dsh plugin, this should be replaced by the Cordis DI composition.
 */
export function createContext() {
  const realsee = new RealseeConsumer()
  const image = new ImageConsumer()
  return {
    realsee,
    image,
    tools: [
      ...realseeTools.tools.map((t) => ({ ...t, handler: (args: unknown) => t.handler({ realsee }, args as never) })),
      ...imageTools.tools.map((t) => ({ ...t, handler: (args: unknown) => t.handler({ image }, args as never) })),
    ],
  }
}
