import path from 'path';
import fs from 'fs-extra';

import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import nodePolifills from 'rollup-plugin-polyfill-node';
import importImage from '@rollup/plugin-image';
import multi from '@rollup/plugin-multi-entry';
import json from '@rollup/plugin-json';

// path for block
const blockSrcDir = path.resolve(process.cwd(), './src/vm/extensions/block');
const blockFile = path.resolve(blockSrcDir, 'samlabs.js');
const blockFile2 = path.resolve(blockSrcDir, 'sambot.js');
// path for entry
const entrySrcDir = path.resolve(process.cwd(), './src/gui/lib/libraries/extensions/entry');
const entryFile = path.resolve(entrySrcDir, 'samlabs.jsx');
const entryFile2 = path.resolve(entrySrcDir, 'sambot.jsx');
// path for output
const moduleName = 'samlabs';
const moduleName2 = 'sambot';
const outputDir = path.resolve(process.cwd(), './dist');
fs.emptyDirSync(outputDir);
const moduleFile = path.resolve(outputDir, `${moduleName}.mjs`);
const moduleFile2 = path.resolve(outputDir, `${moduleName2}.mjs`);

const rollupOptions = [
{
    input: [entryFile, blockFile],
    plugins: [
        multi(),
        importImage(),
        commonjs(),
        nodePolifills(),
        nodeResolve({
            browser: true,
            preferBuiltins: false,
            modulePaths: [
                path.resolve(process.cwd(), './node_modules'),
            ],
        }),
        json(),
        babel({
            babelrc: false,
            presets: [
                ['@babel/preset-env',
                    {
                        "modules": false,
                        targets: {
                            browsers: [
                                'last 3 versions',
                                'Safari >= 8',
                                'iOS >= 8']
                        }
                    }
                ],
                '@babel/preset-react'
            ],
            babelHelpers: 'runtime',
            plugins: [
                '@babel/plugin-transform-react-jsx',
                ["@babel/plugin-transform-runtime",
                    { "regenerator": true }]
            ],
        }),
    ],
    output: {
        file: moduleFile,
        format: 'es',
        sourcemap: true,
    },
    watch: {
        clearScreen: false,
        chokidar: {
            usePolling: true,
        },
        buildDelay: 500,
    },
    external: [],
},
{
    input: [entryFile2, blockFile2],
    plugins: [
        multi(),
        importImage(),
        commonjs(),
        nodePolifills(),
        nodeResolve({
            browser: true,
            preferBuiltins: false,
            modulePaths: [
                path.resolve(process.cwd(), './node_modules'),
            ],
        }),
        json(),
        babel({
            babelrc: false,
            presets: [
                ['@babel/preset-env',
                    {
                        "modules": false,
                        targets: {
                            browsers: [
                                'last 3 versions',
                                'Safari >= 8',
                                'iOS >= 8']
                        }
                    }
                ],
                '@babel/preset-react'
            ],
            babelHelpers: 'runtime',
            plugins: [
                '@babel/plugin-transform-react-jsx',
                ["@babel/plugin-transform-runtime",
                    { "regenerator": true }]
            ],
        }),
    ],
    output: {
        file: moduleFile2,
        format: 'es',
        sourcemap: true,
    },
    watch: {
        clearScreen: false,
        chokidar: {
            usePolling: true,
        },
        buildDelay: 500,
    },
    external: [],
}
]

export default rollupOptions;
