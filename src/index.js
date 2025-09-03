/**
 * 统一入口文件 - 根据环境自动选择适配器
 */

const EnvironmentDetector = require("./environment-detector");

let WkAgent;

if (EnvironmentDetector.isNode()) {
  // Node.js环境 - 使用原始实现
  WkAgent = require("./node-agent");
} else if (EnvironmentDetector.isBrowser()) {
  // 浏览器环境 - 使用浏览器适配器
  WkAgent = require("./browser-agent");
} else {
  // 默认使用Node.js版本（可能在测试环境）
  WkAgent = require("./node-agent");
}

module.exports = WkAgent;
