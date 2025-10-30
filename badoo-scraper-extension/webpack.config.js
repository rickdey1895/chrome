const path = require('path');

module.exports = {
    mode: 'development',
    entry: {
        background: './src/background/service-worker.ts',
        content: './src/content_scripts/scrape.ts',
        popup: './src/popup/popup.ts',
        options: './src/options/options.ts',
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    devtool: 'source-map',
    optimization: {
        splitChunks: {
            chunks: 'all',
        },
    },
};