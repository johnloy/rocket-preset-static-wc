const glob = require('fast-glob')
const path = require('path')
const { addPlugin } = require('plugins-manager')
const parse = require('rehype-parse')
const unified = require('unified')
const unistUtilVisit = require('unist-util-visit')
const { getComputedConfig } = require('@rocket/cli')

/** @typedef {import('@rocket/cli/dist-types/types/main').RocketPreset} RocketPreset */

/**
 * @typedef {Object} PluginOptions
 * @property {string[]} customElementFiles - An array of glob patterns to locate modules exporting custom elements
 */

 /**
  * @typedef {{render: () => string}} Renderable
  */

const htmlStringToHast = unified().use(parse, { fragment: true }).parse

const DEFAULT_OPTIONS = {
  customElementFiles: ['**/*.{js,mjs}'],
}

/** @type {string[]} */
let componentFiles = []

/** @type {Record<string, string>} */
let componentFilesIndex

/** @type {Record<string, new () => Renderable>} */
let componentsIndex 

/** @type {string | null} */
let changedComponent

/**
 * The UnifiedJS plugin attacher function
 *
 * @param {PluginOptions} options - Options
 * @this {import('unified').Parser}
 * @returns {import('unified').Transformer} - A UnifiedJS transformer function
 */
function renderCustomElement(options) {
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
    /** @type {string[]} */
    const missingDefaultExport = []

    if (!componentsIndex) {
      componentsIndex = Object.fromEntries(
        (
          await Promise.all(
            /** Concurrently dynamically import all possible modules export web components */
            /** @type {Array<Promise<[string, new () => Renderable]>>} */(
            Object.entries(componentFilesIndex).map(
              /** @param {[string, string]} */ 
              async ([name, filePath]) => {
                const { default: Component } = await import(filePath)
                if (Component) {
                  return [name, Component]
                }
                missingDefaultExport.push(name)
              }
            ))
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
      const Component = componentsIndex[/** @type {string} */(node.tagName)]

      if (Component) {
        const instance = new Component()
        node.children = htmlStringToHast(instance.render()).children
      }
    })
  }
}

/**
 * 
 * @param {PluginOptions | {}} [userOptions={}] 
 * @returns {Partial<RocketPreset>}
 */
module.exports = function staticCustomElements(userOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...userOptions }

  return {
    path: path.resolve(__dirname),
    setupEleventyPlugins: [
      addPlugin({
        name: 'track-changed-files',
        plugin: 
        function trackChangedFiles(/** @type {EleventyConfig} */ eleventyConfig) {
          eleventyConfig.on('beforeWatch', (/** @type {string[]} */ changedFiles) => {
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
