const path = require('path');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  watch: true,
  watchOptions: {
    aggregateTimeout:500,
    ignored: [/node_modules/, /dist/]
  },
  mode: 'production',
  devtool: 'inline-source-map',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'track.js',
    library: 'Track',
    globalObject: 'this',
    libraryTarget: 'umd'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js' ]
  },
  plugins: [
    // new BundleAnalyzerPlugin()
  ]
};
