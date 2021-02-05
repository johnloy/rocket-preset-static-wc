import glob from 'fast-glob'
import path from 'path'
import { addPlugin } from 'plugins-manager'
import parse from 'rehype-parse'
import unified from 'unified'
import unistUtilVisit from 'unist-util-visit'
import { getComputedConfig } from '@rocket/cli'
import { RocketPreset as preset } from '@rocket/cli/dist-types/types/main'

interface PluginOptions {
  customElementFiles: string[]
}

interface Renderable {
  render(): string
}

const htmlStringToHast = unified().use(parse, { fragment: true }).parse

const DEFAULT_OPTIONS = {
  customElementFiles: ['**/*.{js,mjs}'],
}

let componentFiles: string[] = []
let componentFilesIndex: Record<string, string>
let componentsIndex: Record<string, new () => Renderable>
let changedComponent: string | null

/**
 * The UnifiedJS plugin attacher function
 *
 * @param options - Options
 */
function renderCustomElement(this: unified.Processor, options: PluginOptions): unified.Transformer {
  const { customElementFiles } = options

  const rocketConfig = getComputedConfig()

  if (!componentFilesIndex) {
    componentFiles = glob.sync(customElementFiles, {
      ignore: ['_merged_assets/**'],
      absolute: true,
      cwd: path.resolve(rocketConfig.inputDir),
    })
    componentFilesIndex = Object.fromEntries(componentFiles.map((f) => [path.parse(f).name, f]))
  }

  return async (tree) => {
    const missingDefaultExport: string[] = []

    if (!componentsIndex) {
      componentsIndex = Object.fromEntries(
        (
          await Promise.all(
            /** Concurrently dynamically import all possible modules export web components */
            Object.entries(componentFilesIndex).map(async ([name, filePath]: [string, string]) => {
              const { default: Component } = await import(filePath)
              if (Component) {
                return [name, Component]
              }
              missingDefaultExport.push(name)
            }) as Array<Promise<[string, new () => Renderable]>>
          )
        ).filter((entry) => entry)
      )
    } else if (changedComponent) {
      const { default: Component } = await import(
        `${componentFilesIndex[changedComponent]}?cachebust=${new Date().getTime()}`
      )
      if (Component) {
        /** Update the index after watched components change */
        componentsIndex[changedComponent] = Component
      } else {
        missingDefaultExport.push(changedComponent)
      }
    }

    if (missingDefaultExport.length) {
      console.warn(`Missing default exports: ${missingDefaultExport.join(', ')}`)
    }
    missingDefaultExport.length = 0

    /** Recursively replace web component nodes with rendered output */
    unistUtilVisit(tree, (node) => {
      const Component = componentsIndex[node.tagName as string]

      if (Component) {
        const instance = new Component()
        node.children = htmlStringToHast(instance.render()).children
      }
    })
  }
}

export function staticCustomElements(userOptions = {}): Partial<preset> {
  const options = { ...DEFAULT_OPTIONS, ...userOptions }

  return {
    path: path.resolve(__dirname),
    setupEleventyPlugins: [
      addPlugin({
        name: 'track-changed-files',
        plugin: function trackChangedFiles(eleventyConfig: EleventyConfig) {
          eleventyConfig.on('beforeWatch', (changedFiles: string[]) => {
            changedComponent = null
            for (const relPath of changedFiles) {
              if (componentFiles.includes(path.resolve(relPath))) {
                changedComponent = path.parse(relPath).name
                break
              }
            }
          })
        },
        // TODO: Make PR for plugin-manager to make these properties optional
        options: {},
        how: undefined,
        location: undefined,
      }),
    ],
    setupUnifiedPlugins: [
      addPlugin({
        name: 'static-custom-elements',
        plugin: renderCustomElement,
        location: 'raw',
        options: {
          customElementFiles: options.customElementFiles,
        },
        how: undefined,
      }),
    ],
  }
}
