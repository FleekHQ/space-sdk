const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const path = require('path');

module.exports = {
  mode: "development",
  entry: {
    lib: './src/index.ts',
    example: './example/index.ts',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
  },
  output: {
    filename: '[name].bundle.js',
  path: path.resolve(__dirname, 'bundle'),
  },
  plugins: [
    new CleanWebpackPlugin({ cleanStaleWebpackAssets: false }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'example/index.html',
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    new Dotenv(),
  ],
  devServer: {
    contentBase: path.join(__dirname, 'bundle'),
    port: 3002,

  },
  devtool: 'inline-source-map',
  resolve: {
    fallback: {
      crypto: require.resolve("crypto-browserify"),
      util: require.resolve("util/"),
      stream: require.resolve("stream-browserify"),
    },
    extensions: [ '.tsx', '.ts', '.js'],
  }
};
