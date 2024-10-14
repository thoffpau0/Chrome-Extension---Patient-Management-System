// webpack.config.js
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const constants = require('./src/constants.js'); // Ensure correct path

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
        mode: isProduction ? 'production' : 'development',
        entry: {
            background: ['./src/globals.js', './src/background.js']
        },
        output: {
            filename: '[name].bundle.js',
            path: path.resolve(__dirname, 'dist'),
            clean: true
        },
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
        target: 'webworker',
        devtool: isProduction ? 'source-map' : 'inline-source-map', // Source maps for debugging 
		plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: 'manifest.template.json',
                        to: 'manifest.json',
                        transform(content, path) {
                            return content.toString()
                                .replace('<%= DEFAULT_MP3_FILENAME %>', constants.DEFAULT_MP3_FILENAME)
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
                    },
                    {
                        from: 'content_scripts/',
                        to: 'content_scripts/'
                    }
                ]
            })
        ]
    };
};