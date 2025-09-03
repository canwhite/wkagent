const path = require('path');

module.exports = [
  // Node.js构建配置
  {
    name: 'node',
    target: 'node',
    entry: './work-agent.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'wkagent.node.js',
      library: {
        type: 'commonjs2'
      }
    },
    mode: 'production',
    externals: {
      fs: 'commonjs fs',
      path: 'commonjs path',
      child_process: 'commonjs child_process',
      util: 'commonjs util',
      glob: 'commonjs glob',
      'node-fetch': 'commonjs node-fetch'
    }
  },
  
  // 浏览器构建配置
  {
    name: 'browser',
    target: 'web',
    entry: './src/browser.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'wkagent.browser.js',
      library: {
        name: 'WkAgent',
        type: 'umd'
      },
      globalObject: 'this'
    },
    mode: 'production',
    resolve: {
      fallback: {
        "fs": false,
        "path": require.resolve("path-browserify"),
        "child_process": false,
        "util": require.resolve("util/"),
        "os": false,
        "crypto": false
      }
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
    }
  }
];