# SubAgent 系统完整指南

基于 course.md 架构的 I2A 子 Agent 实现，支持并发执行、隔离环境和任务分解。

## 🎯 SubAgent 架构概述

SubAgent 系统实现了 course.md 中提到的 I2A 函数，为每个子任务创建独立的执行环境：

```
主Agent (nO主循环)
    ↓
Task工具 (cX="Task")
    ↓
SubAgent实例化 (I2A函数)
    ↓
独立执行环境
    ↓
结果返回主Agent
```

## 🏗️ 核心组件

### 1. SubAgent 类

独立的任务执行单元，具备以下特性：

- **隔离环境**: 独立的内存、工具和配置
- **超时机制**: 默认 30 秒超时保护
- **沙箱模式**: 限制权限执行
- **事件驱动**: 完整的生命周期事件

### 2. SubAgentManager

管理多个 SubAgent 的创建和调度：

- **并发控制**: 限制最大并发数
- **生命周期管理**: 自动清理已完成任务
- **状态监控**: 实时状态追踪

### 3. TaskTool

创建 SubAgent 的便捷接口，兼容主 Agent 工具系统。

## 🚀 快速开始

### 基础使用

```javascript
const WkAgent = require("./work-agent");

const agent = new WkAgent({
  enableLearning: true,
  maxConcurrency: 10,
});

// 使用Task工具创建SubAgent
const result = await agent.execute({
  task: "使用task工具分析项目",
  context: {
    taskParams: {
      description: "项目分析",
      prompt: "扫描并分析当前目录结构",
    },
  },
});
```

### 直接创建 SubAgent

```javascript
const { SubAgent } = require("./sub-agent");

const subAgent = new SubAgent(
  {},
  {
    task: "分析代码质量",
    description: "质量分析",
    parentId: "main_agent",
  }
);

const result = await subAgent.execute("分析agent-core.js文件");
```

### 并发执行多个 SubAgent

```javascript
const tasks = [
  { task: "分析文件1.js", description: "文件分析1" },
  { task: "分析文件2.js", description: "文件分析2" },
  { task: "分析文件3.js", description: "文件分析3" },
];

const results = await agent.executeSubTasksConcurrently(tasks);
```

## 📋 任务分解机制

### 自动任务分解

SubAgent 会自动将复杂任务分解为可执行的步骤：

```javascript
// 复杂任务
"重构项目代码结构"[
  // 自动分解为：
  ("扫描项目结构", "识别重构点", "创建备份", "执行重构", "验证结果")
];
```

### LLM 增强分解

启用 LLM 后，使用 Claude API 进行智能任务理解：

```javascript
const agent = new WkAgent({
  llm: {
    enableLLM: true,
    apiKey: process.env.CLAUDE_API_KEY,
  },
});

// LLM会自动理解任务并生成最优分解
await agent.execute({
  task: "使用task工具优化React组件",
  context: {
    taskParams: {
      description: "React优化",
      prompt: "分析React组件性能瓶颈并提供优化建议",
    },
  },
});
```

## 🔄 并发调度

### UH1 调度器实现

基于 course.md 的 UH1 并发控制机制：

```javascript
// 最大10个并发SubAgent
const agent = new WkAgent({
  maxConcurrency: 10,
  subAgent: {
    maxSubAgents: 10,
    timeout: 30000,
  },
});

// 并发执行5个分析任务
const results = await agent.executeSubTasksConcurrently([
  { task: "分析App.js", description: "主组件分析" },
  { task: "分析utils.js", description: "工具函数分析" },
  { task: "分析styles.css", description: "样式文件分析" },
  { task: "分析package.json", description: "依赖分析" },
  { task: "分析README.md", description: "文档分析" },
]);
```

## 📊 状态监控

### 实时状态追踪

```javascript
// 获取SubAgent状态
const status = agent.getSubAgentStatus();
console.log(status);
// 输出：
// {
//   totalSubAgents: 3,
//   maxSubAgents: 10,
//   subAgents: [
//     {
//       id: "subagent_xxx",
//       parentId: "main_agent",
//       task: "分析文件",
//       isRunning: true,
//       duration: 1500,
//       memoryUsage: { shortTerm: 5, mediumTerm: 0 }
//     }
//   ]
// }
```

### 事件监听

```javascript
// 监听SubAgent生命周期事件
agent.on("subAgent:start", (data) => {
  console.log(`SubAgent ${data.subAgentId} 启动`);
});

agent.on("subAgent:complete", (result) => {
  console.log(`SubAgent ${result.subAgentId} 完成`);
});

agent.on("subAgent:error", (error) => {
  console.error(`SubAgent ${error.subAgentId} 失败`);
});
```

## 🔧 高级用法

### 自定义 SubAgent 配置

```javascript
const subAgent = new SubAgent(
  {
    maxConcurrency: 3,
    timeout: 60000,
    llm: {
      enableLLM: true,
      maxTokens: 1000,
    },
  },
  {
    task: "深度代码分析",
    description: "高级分析",
    parentId: "analysis_session",
  }
);
```

### 任务中断和恢复

```javascript
const subAgent = new SubAgent({}, { task: "长任务" });

// 启动任务
const promise = subAgent.execute("执行长时间分析");

// 5秒后中断
setTimeout(() => {
  subAgent.abort();
}, 5000);

try {
  const result = await promise;
  console.log(result);
} catch (error) {
  console.log("任务被中断");
}
```

### 使用 SubAgentManager

```javascript
const { SubAgentManager } = require("./sub-agent");

const manager = new SubAgentManager({
  maxSubAgents: 5,
  maxConcurrency: 3,
});

// 批量创建和执行
const tasks = [
  { task: "任务1", description: "描述1" },
  { task: "任务2", description: "描述2" },
  { task: "任务3", description: "描述3" },
];

const results = await manager.executeConcurrent(tasks);

// 监控状态
console.log(manager.getStatus());
```

## 📈 性能优化

### 并发策略

```javascript
// 根据任务类型调整并发数
const config = {
  // 文件操作：高并发
  fileOperations: { maxConcurrency: 10 },

  // 网络请求：中等并发
  networkRequests: { maxConcurrency: 5 },

  // 系统命令：低并发
  systemCommands: { maxConcurrency: 3 },
};
```

### 内存管理

```javascript
// 自动内存压缩
const agent = new WkAgent({
  memory: {
    shortTermLimit: 50,
    mediumTermLimit: 20,
    autoCompress: true,
  },
});
```

## 🛡️ 安全特性

### 沙箱隔离

```javascript
const subAgent = new SubAgent({
  sandbox: true, // 启用沙箱模式
  timeout: 30000, // 30秒超时
  maxMemory: 100 * 1024 * 1024, // 100MB内存限制
  allowedTools: ["read", "write", "grep"], // 允许的工具列表
});
```

### 权限控制

```javascript
// 限制SubAgent权限
const config = {
  subAgent: {
    allowWrite: false, // 禁止写操作
    allowDelete: false, // 禁止删除操作
    allowNetwork: false, // 禁止网络访问
    allowSystem: false, // 禁止系统命令
  },
};
```

## 🎯 实际应用场景

### 1. 大型项目分析

```javascript
// 并发分析多个模块
const modules = [
  { task: "分析src/components目录", description: "组件分析" },
  { task: "分析src/utils目录", description: "工具函数分析" },
  { task: "分析src/services目录", description: "服务层分析" },
  { task: "分析tests目录", description: "测试分析" },
];

const results = await agent.executeSubTasksConcurrently(modules);
```

### 2. 代码重构

```javascript
// 分阶段重构
const refactorSteps = [
  { task: "识别重复代码", description: "代码去重" },
  { task: "提取公共函数", description: "函数提取" },
  { task: "更新引用", description: "引用更新" },
  { task: "验证重构", description: "结果验证" },
];

const results = await agent.executeSubTasksConcurrently(refactorSteps);
```

### 3. 依赖分析

```javascript
// 分析项目依赖
const analysisTasks = [
  { task: "分析package.json", description: "依赖分析" },
  { task: "检查安全漏洞", description: "安全检查" },
  { task: "优化建议", description: "优化分析" },
];

const results = await agent.executeSubTasksConcurrently(analysisTasks);
```

## 📊 监控和调试

### 性能监控

```javascript
const agent = new WkAgent();

// 实时监控
setInterval(() => {
  const status = agent.getSubAgentStatus();
  console.log(`活跃SubAgent: ${status.totalSubAgents}/${status.maxSubAgents}`);
}, 5000);

// 内存监控
setInterval(() => {
  const status = agent.getStatus();
  console.log(
    `内存使用: ${status.memory.shortTerm}/${status.memory.mediumTerm}`
  );
}, 10000);
```

### 调试工具

```javascript
// 调试模式
const agent = new WkAgent({
  debug: true,
  logLevel: "verbose",
});

// 详细日志
agent.on("subAgent:start", console.log);
agent.on("subAgent:complete", console.log);
agent.on("subAgent:error", console.error);
```

## 🚀 最佳实践

### 1. 任务粒度控制

- **大任务**: 使用 SubAgent 自动分解
- **小任务**: 直接由主 Agent 执行
- **中等任务**: 手动分解为 2-3 个 SubAgent

### 2. 并发策略

- **I/O 密集型**: 高并发(8-10 个)
- **CPU 密集型**: 低并发(2-4 个)
- **网络请求**: 中等并发(4-6 个)

### 3. 错误处理

```javascript
// 健壮的SubAgent执行
async function safeExecute(agent, task) {
  try {
    return await agent.execute({
      task,
      context: { timeout: 30000 },
    });
  } catch (error) {
    console.error("SubAgent执行失败:", error);
    return { success: false, error: error.message };
  }
}
```

## 📚 运行示例

```bash
# 运行所有SubAgent示例
node sub-agent-examples.js --all

# 快速测试
node sub-agent-examples.js --quick

# 特定示例
node -e "const {concurrentSubAgentExample} = require('./sub-agent-examples'); concurrentSubAgentExample()"
```

---

## 🔗 架构总结

SubAgent 系统完整实现了 course.md 中的 I2A 函数，提供了：

- ✅ **I2A 实例化**: 独立的 SubAgent 创建
- ✅ **隔离执行**: 沙箱环境和独立配置
- ✅ **并发调度**: UH1 调度器实现
- ✅ **任务分解**: 智能步骤分解
- ✅ **状态监控**: 实时生命周期管理
- ✅ **错误恢复**: 多层异常处理

这个系统为复杂任务提供了企业级的并发执行能力，同时保持了安全性和可扩展性。
