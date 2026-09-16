import path from 'path';
import { StatsWriterPlugin } from 'webpack-stats-plugin';
import { DuplicatesPlugin } from 'inspectpack/plugin';
import { WebpackBundleSizeAnalyzerPlugin } from 'webpack-bundle-size-analyzer';
import TerserPlugin from 'terser-webpack-plugin';

const module = {
  rules: [
    {
      test: /\.js$/,
      // `cross-fetch` requires a number of polyfills (like Promise), so we
      // let `@babel/plugin-transform-runtime` inject them.
      exclude: /node_modules\/(?!cross-fetch\/)/,
      use: {
        loader: 'babel-loader',
      },
    },
  ],
};

const browser = {
  mode: 'production',
  entry: ['./src/index.js'],
  target: 'web',
  performance: {
    hints: false,
  },
  output: {
    path: path.resolve('./dist'),
    filename: 'swagger-client.browser.js',
    libraryTarget: 'umd',
    library: 'SwaggerClient',
    libraryExport: 'default',
    globalObject: 'window',
  },
  externals: {
    esprima: true,
  },
  resolve: {
    modules: ['node_modules'],
    extensions: ['.js', '.json'],
  },
  module,
  plugins: [
    new DuplicatesPlugin({
      // emit compilation warning or error? (Default: `false`)
      emitErrors: false, // https://github.com/FormidableLabs/inspectpack/issues/181
      // display full duplicates information? (Default: `false`)
      verbose: true,
    }),
  ],
  optimization: {
    minimize: false,
    usedExports: false,
    concatenateModules: false,
  },
};

const browserMin = {
  mode: 'production',
  entry: ['./src/index.js'],
  target: 'web',
  devtool: 'source-map',
  performance: {
    hints: 'error',
    maxEntrypointSize: 590000, // Increased for OpenAPI 3.2 support
    maxAssetSize: 60000000, // Increased for bundle stats file
  },
  output: {
    path: path.resolve('./dist'),
    filename: 'swagger-client.browser.min.js',
    libraryTarget: 'umd',
    library: 'SwaggerClient',
    libraryExport: 'default',
    globalObject: 'window',
  },
  externals: {
    esprima: true,
  },
  resolve: {
    modules: ['node_modules'],
    extensions: ['.js', '.json'],
  },
  module,
  plugins: [
    new WebpackBundleSizeAnalyzerPlugin('swagger-client.browser-sizes.txt'),
    new StatsWriterPlugin({
      filename: path.join('swagger-client.browser-stats.json'),
      fields: null,
    }),
  ],
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            warnings: false,
          },
          output: {
            comments: false,
          },
        },
      }),
    ],
  },
};

export default [browser, browserMin];
