## wkagent - 智能 Agent 系统

JS Agent 系统，集成 LLM 增强智能决策能力，具备安全的多层级记忆管理和工具自动选择调用能力。  
主从 agent，从属 agent 并发，结果自动合并

## 🎯 核心架构流程

### 1. 任务执行主流程 (work-agent.js:95-137)

```javascript
// 核心执行流程
async execute(request) {
  const taskId = `task_${++this.taskId}`;

  // 1. 记录任务到内存
  this.memory.addToShortTerm({ type: "task_request", content: request.task });

  // 2. 任务理解和分解
  const taskAnalysis = await this.analyzeTask(request);

  // 3. 执行分解后的子任务
  const results = await this.executeSubTasks(taskAnalysis, request.context);

  // 4. 汇总结果
  const summary = await this.summarizeResults(results, taskAnalysis);

  return { taskId, summary, results, metadata };
}
```

### 2. 三层记忆架构 (enhanced-memory.js:7-52)

```javascript
class EnhancedAgentMemory {
  constructor() {
    this.shortTerm = []; // 短期记忆：当前会话 + LLM消息
    this.mediumTerm = []; // 中期记忆：8段式结构化压缩
    this.longTerm = {}; // 长期记忆：项目配置和持久数据

    this.llmMessages = []; // 完整的LLM对话历史
    this.messagesByRole = { user: [], assistant: [], system: [], tool: [] };
  }
}
```

### 3. 智能压缩机制 (enhanced-memory.js:199-227)

```javascript
compressMemory() {
  const compressed = this.generateStructuredSummary();

  this.mediumTerm.push({
    type: "structured_compression",
    summary: compressed,                    // 8段式结构化摘要
    originalCount: this.shortTerm.length,   // 压缩前消息数
    originalTokens: this.contextStats.totalTokens, // 压缩前tokens
  });

  this.shortTerm = this.shortTerm.slice(-20); // 保留最近20条
  this.cleanupMemory(); // 清理过期数据
}
```

### 4. 安全工具系统 (agent-core.js:330-580)

```javascript
// 路径安全验证
static validatePath(inputPath, basePath = process.cwd()) {
  const resolvedPath = path.resolve(basePath, normalizedPath);
  const relative = path.relative(basePath, resolvedPath);
  if (relative.startsWith('..')) {
    throw new Error('路径不允许访问父目录');
  }
  return resolvedPath;
}

// 命令白名单控制
const allowedCommands = new Set(['ls', 'cat', 'pwd', 'echo', 'grep']);
```

### 5.context 管理

```
  LLM消息 → addMessage() → 短期记忆 + LLM消息队列
                            ↓
                      92% token阈值触发
                            ↓
                      compressMemory() → 8段式压缩
                            ↓
                      getLLMContext() → 提供给LLM
```

## 🛡️ 安全特性

- **路径遍历防护**: 所有文件操作都经过路径验证
- **命令注入防护**: 使用命令白名单和参数验证
- **敏感信息保护**: 自动脱敏 API 密钥等敏感信息
- **内存限制**: 50MB 内存上限，自动垃圾回收
- **错误重试**: LLM 调用具备指数退避重试机制

## 📊 8 段式记忆摘要格式

每次内存压缩生成结构化摘要：

- `backgroundContext`: 背景上下文
- `keyDecisions`: 关键决策记录
- `toolUsage`: 工具使用统计
- `userIntent`: 用户意图分析
- `executionResults`: 执行结果
- `errorHandling`: 错误处理记录
- `openIssues`: 未解决问题
- `futurePlans`: 未来计划

## 🚀 快速开始

### 环境要求

- Node.js (version 18+)
- npm 或 yarn

### 安装

```bash
npm install
```

### 配置环境变量

创建 `.env` 文件：

```bash
DEEPSEEK_API_KEY=your_api_key_here
```

### 运行测试

```bash
npm test        # 运行完整测试
npm run dev     # 开发模式
npm start       # 生产模式
```

## 📖 使用示例

### 基本任务执行

```javascript
const WkAgent = require("./work-agent");

const agent = new WkAgent({
  llm: {
    enableLLM: true,
    apiKey: process.env.DEEPSEEK_API_KEY,
  },
});

// 执行文件创建任务
const result = await agent.execute({
  task: "创建一个Node.js HTTP服务器",
  context: { projectPath: process.cwd() },
});
```

### 内存状态查看

```javascript
const status = agent.getStatus();
console.log("内存使用:", status.memory);
console.log("活跃任务:", status.activeTasks);
```

## 📁 核心文件结构

```
├── work-agent.js          # 主Agent类 - 任务协调器
├── agent-core.js          # 核心模块 - LLM服务+工具注册+安全管理
├── enhanced-memory.js     # 三层记忆系统实现
├── sub-agent.js           # 子Agent管理器
└── test/test-simple.js         # 测试和示例
```

## 🎯 技术亮点

1. **智能决策**: LLM 驱动的任务理解和工具选择
2. **安全优先**: 多层安全防护机制
3. **可扩展**: 模块化设计，易于添加新工具
4. **高性能**: 智能内存压缩和垃圾回收
5. **可观测**: 完整的执行日志和状态监控
