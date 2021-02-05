"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.staticCustomElements = void 0;
const fast_glob_1 = __importDefault(require("fast-glob"));
const path_1 = __importDefault(require("path"));
const plugins_manager_1 = require("plugins-manager");
const rehype_parse_1 = __importDefault(require("rehype-parse"));
const unified_1 = __importDefault(require("unified"));
const unist_util_visit_1 = __importDefault(require("unist-util-visit"));
const cli_1 = require("@rocket/cli");
const htmlStringToHast = unified_1.default().use(rehype_parse_1.default, { fragment: true }).parse;
const DEFAULT_OPTIONS = {
    customElementFiles: ['**/*.{js,mjs}'],
};
let componentFiles = [];
let componentFilesIndex;
let componentsIndex;
let changedComponent;
/**
 * The UnifiedJS plugin attacher function
 *
 * @param options - Options
 */
function renderCustomElement(options) {
    const { customElementFiles } = options;
    const rocketConfig = cli_1.getComputedConfig();
    if (!componentFilesIndex) {
        componentFiles = fast_glob_1.default.sync(customElementFiles, {
            ignore: ['_merged_assets/**'],
            absolute: true,
            cwd: path_1.default.resolve(rocketConfig.inputDir),
        });
        componentFilesIndex = Object.fromEntries(componentFiles.map((f) => [path_1.default.parse(f).name, f]));
    }
    return async (tree) => {
        const missingDefaultExport = [];
        if (!componentsIndex) {
            componentsIndex = Object.fromEntries((await Promise.all(
            /** Concurrently dynamically import all possible modules export web components */
            Object.entries(componentFilesIndex).map(async ([name, filePath]) => {
                const { default: Component } = await Promise.resolve().then(() => __importStar(require(filePath)));
                if (Component) {
                    return [name, Component];
                }
                missingDefaultExport.push(name);
            }))).filter((entry) => entry));
        }
        else if (changedComponent) {
            const { default: Component } = await Promise.resolve().then(() => __importStar(require(`${componentFilesIndex[changedComponent]}?cachebust=${new Date().getTime()}`)));
            if (Component) {
                /** Update the index after watched components change */
                componentsIndex[changedComponent] = Component;
            }
            else {
                missingDefaultExport.push(changedComponent);
            }
        }
        if (missingDefaultExport.length) {
            console.warn(`Missing default exports: ${missingDefaultExport.join(', ')}`);
        }
        missingDefaultExport.length = 0;
        /** Recursively replace web component nodes with rendered output */
        unist_util_visit_1.default(tree, (node) => {
            const Component = componentsIndex[node.tagName];
            if (Component) {
                const instance = new Component();
                node.children = htmlStringToHast(instance.render()).children;
            }
        });
    };
}
function staticCustomElements(userOptions = {}) {
    const options = { ...DEFAULT_OPTIONS, ...userOptions };
    return {
        path: path_1.default.resolve(__dirname),
        setupEleventyPlugins: [
            plugins_manager_1.addPlugin({
                name: 'track-changed-files',
                plugin: function trackChangedFiles(eleventyConfig) {
                    eleventyConfig.on('beforeWatch', (changedFiles) => {
                        changedComponent = null;
                        for (const relPath of changedFiles) {
                            if (componentFiles.includes(path_1.default.resolve(relPath))) {
                                changedComponent = path_1.default.parse(relPath).name;
                                break;
                            }
                        }
                    });
                },
                // TODO: Make PR for plugin-manager to make these properties optional
                options: {},
                how: undefined,
                location: undefined,
            }),
        ],
        setupUnifiedPlugins: [
            plugins_manager_1.addPlugin({
                name: 'static-custom-elements',
                plugin: renderCustomElement,
                location: 'raw',
                options: {
                    customElementFiles: options.customElementFiles,
                },
                how: undefined,
            }),
        ],
    };
}
exports.staticCustomElements = staticCustomElements;
//# sourceMappingURL=index.js.map