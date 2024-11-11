// webpack.config.mjs
import path from 'path';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { Constants } from './src/constants.js'; // Ensure correct path and named export

const isProduction = process.env.NODE_ENV === 'production';

// Common configuration properties
const commonConfig = {
    mode: isProduction ? 'production' : 'development',
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    resolve: {
        extensions: ['.js']
    },
    devtool: isProduction ? 'source-map' : 'inline-source-map',
    optimization: {
        splitChunks: {
            chunks: 'all',
            name: 'shared'
        }
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'manifest.template.json',
                    to: 'manifest.json',
                    transform(content, path) {
                        return content.toString()
                            .replace('<%= DEFAULT_MP3_FILENAME %>', Constants.DEFAULT_MP3_FILENAME)
                    }
                },
                {
                    from: 'resources/',
                    to: 'resources/'
                },
                {
                    from: 'icons/',
                    to: 'icons/'
                },
                {
                    from: 'html/',
                    to: 'html/'
                }
                // Do not copy 'content_scripts/' as they are bundled
            ]
        })
    ]
};

// Background configuration
const backgroundConfig = {
    ...commonConfig,
    name: 'background',
    entry: {
        background: './src/background.js'
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(process.cwd(), 'dist'),
        clean: true
    },
    target: 'webworker', // Suitable for background service workers
};

// Content scripts configuration
const contentScriptsEntries = {
    main: './src/content_scripts/main.js',
    domHandlers: './src/content_scripts/domHandlers.js',
    messageHandler: './src/content_scripts/messageHandler.js',
    audioManager: './src/content_scripts/audioManager.js',
    options: './src/content_scripts/options.js',
    patientManager: './src/content_scripts/patientManager.js',
    utilities: './src/content_scripts/utilities.js'
};

const contentScriptsConfig = {
    ...commonConfig,
    name: 'content-scripts',
    entry: contentScriptsEntries,
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(process.cwd(), 'dist'),
        clean: false // Do not clean the 'dist' folder to prevent deleting background.bundle.js
    },
    target: 'web', // Suitable for content scripts
};

// Export both configurations
export default [backgroundConfig, contentScriptsConfig];
