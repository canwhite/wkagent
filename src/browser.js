/**
 * 浏览器专用入口文件
 */

const BrowserWkAgent = require('./browser-agent');

// 浏览器环境直接导出浏览器版本的Agent
module.exports = BrowserWkAgent;

// 如果是浏览器全局环境，则挂载到window
if (typeof window !== 'undefined') {
  window.WkAgent = BrowserWkAgent;
}