// eslint-disable-next-line @typescript-eslint/no-var-requires
const Dotenv = require('dotenv-webpack');

module.exports = {
  target: 'web',
  plugins: [
    new Dotenv({
      path: 'integration_tests/.env',
      safe: 'integration_tests/test.env',
    }),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolveLoader: {
    modules: ['../../node_modules'],
  },
  resolve: {
    modules: ['./node_modules'],
    extensions: ['.tsx', '.ts', '.js'],
  },
};
