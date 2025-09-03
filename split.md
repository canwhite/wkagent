# 环境拆分简明分析

## 实际构建结果
```
dist/
├── wkagent.node.js          # Node.js版本 (55.2KB)
├── wkagent.browser.js       # 浏览器版本 (22.7KB)
└── wkagent.browser.js.LICENSE.txt
```

## 核心拆分逻辑

### 1. 环境检测
```javascript
// 检测当前环境
if (typeof window !== 'undefined') return 'browser';
if (typeof process !== 'undefined') return 'node';
```

### 2. 功能对比
| 功能 | Node.js | 浏览器 |
|---|---|---|
| 文件系统 | 真实文件 | localStorage |
| 进程管理 | child_process | 模拟实现 |
| shell命令 | 支持 | 不支持 |
| 存储容量 | 磁盘大小 | 5MB限制 |

### 3. 构建差异
- **Node.js版本**: 使用原生模块，体积大但功能完整
- **浏览器版本**: 使用polyfill替代，体积小但功能有限

### 4. 使用方式
```javascript
// Node.js
const WkAgent = require('./dist/wkagent.node.js');

// 浏览器
const agent = new WkAgent(); // 全局变量
```

### 5. 配置修正
package.json中多余的配置需要清理：
- 移除不存在的 `wkagent.esm.js`
- 简化exports配置