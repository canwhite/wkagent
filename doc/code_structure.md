# Work Agent 工作流程与关键代码分析

## 核心工作流程

### 1. 任务执行主流程

```javascript
// 入口：agent.execute(request)
// work-agent.js:95-137
async execute(request) {
  const taskId = `task_${++this.taskId}`;

  try {
    this.emit("task:start", taskId);

    // 1. 记忆记录
    this.memory.addToShortTerm({
      type: "task_request",
      content: request.task,
      context: request.context,
      taskId: taskId,
      timestamp: Date.now(),
    });

    // 2. 任务分析
    const taskAnalysis = await this.analyzeTask(request);

    // 3. 执行子任务
    const results = await this.executeSubTasks(taskAnalysis, request.context);

    // 4. 结果汇总
    const summary = await this.summarizeResults(results, taskAnalysis);

    this.emit("task:complete", taskId, summary);

    return {
      taskId,
      summary: summary,
      results: results,
      metadata: {
        duration: Date.now() - startTime,
        toolsUsed: results.map((r) => r.tool).filter(Boolean),
        llmUsed: this.config.llm.enableLLM,
      },
    };
  } catch (error) {
    this.emit("task:error", taskId, error);
    throw error;
  }
}
```

### 2. 任务分析流程

```javascript
// 双重分析策略：LLM + 规则引擎
// work-agent.js:139-163
async analyzeTask(request) {
  if (this.llmService && this.config.llm.enableLLM) {
    try {
      const analysis = await this.llmService.understandTask(
        request.task,
        request.context
      );
      return {
        type: "llm",
        originalTask: request.task,
        analysis: analysis,
        steps: analysis.steps || [request.task],
        tools: analysis.tools || [],
      };
    } catch (error) {
      // LLM失败时回退到规则引擎
      return this.ruleBasedAnalysis(request.task);
    }
  } else {
    return this.ruleBasedAnalysis(request.task);
  }
}

// 规则引擎实现
// work-agent.js:168-194
ruleBasedAnalysis(task) {
  const keywords = {
    创建: ["write"],
    读取: ["read"],
    编辑: ["edit"],
    搜索: ["grep", "glob"],
    查找: ["grep", "glob"],
    执行: ["bash"],
    运行: ["bash"],
  };

  const taskLower = task.toLowerCase();
  const tools = [];

  Object.entries(keywords).forEach(([keyword, toolList]) => {
    if (taskLower.includes(keyword)) {
      tools.push(...toolList);
    }
  });

  return {
    type: "rule",
    originalTask: task,
    steps: [task],
    tools: [...new Set(tools)],
  };
}
```

### 3. 工具选择与执行

```javascript
// 工具选择逻辑
// work-agent.js:221-274
async executeStep(step, preferredTools, context) {
  let tools = preferredTools;

  // LLM工具选择（如果启用）
  if (this.llmService && this.config.llm.enableLLM) {
    try {
      const availableTools = this.registry.getAll();
      const selectedTools = await this.llmService.selectTools(
        step,
        availableTools
      );
      if (selectedTools.length > 0) {
        tools = selectedTools;
      }
    } catch (error) {
      console.warn("LLM工具选择失败，使用默认工具:", error.message);
    }
  }

  // 选择最佳工具
  const tool = this.selectBestTool(step, tools);
  if (!tool) {
    return { success: false, error: "没有合适的工具可用", step: step };
  }

  // 参数解析和验证
  const params = this.parseToolParams(step, tool, context);
  const validation = this.registry.validateParams(tool, params);
  if (!validation.valid) {
    return { success: false, error: validation.error, step: step };
  }

  // 执行工具
  const toolDef = this.registry.get(tool);
  const result = await toolDef.execute(params);

  return {
    tool: tool,
    step: step,
    params: params,
    result: result,
    success: result.success,
  };
}
```

### 4. 参数解析机制

```javascript
// 智能参数解析
// work-agent.js:305-349
parseToolParams(step, tool, context) {
  const params = {};
  const words = step.split(/\s+/);

  switch (tool) {
    case "read":
      params.path = this.extractFilePath(step) || context.projectPath;
      break;

    case "write":
      params.path = context.outputPath || "output.txt";
      params.content = step.replace(/创建|写入/g, "").trim();
      break;

    case "edit":
      params.path = this.extractFilePath(step);
      const editMatch = step.match(/将(.+?)替换为(.+)/);
      if (editMatch) {
        params.oldString = editMatch[1].trim();
        params.newString = editMatch[2].trim();
      }
      break;

    case "bash":
      params.command = step.replace(/执行|运行/g, "").trim();
      break;

    case "grep":
      params.pattern = this.extractPattern(step);
      params.cwd = context.projectPath || ".";
      break;

    case "glob":
      params.pattern = this.extractPattern(step) || "**/*";
      params.cwd = context.projectPath || ".";
      break;
  }

  return params;
}
```

## 核心工具实现

### 1. 文件系统工具

```javascript
// agent-core.js:255-288
// 文件写入工具
this.register("write", {
  name: "write",
  description: "写入文件内容",
  execute: async (params) => {
    const fs = require("fs").promises;
    try {
      await fs.writeFile(params.path, params.content, "utf-8");
      return { success: true, message: "文件写入成功" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  schema: {
    path: { type: "string", required: true, description: "文件路径" },
    content: { type: "string", required: true, description: "文件内容" },
  },
});
```

### 2. 系统命令工具

```javascript
// agent-core.js:315-342
// Bash命令执行工具
this.register("bash", {
  name: "bash",
  description: "执行bash命令",
  execute: async (params) => {
    const { exec } = require("child_process");
    const util = require("util");
    const execAsync = util.promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(params.command);
      return {
        success: true,
        output: stdout,
        error: stderr,
        type: "command_output",
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  schema: {
    command: {
      type: "string",
      required: true,
      description: "要执行的命令",
    },
  },
});
```

## 记忆系统工作流程

### 1. 记忆存储

```javascript
// agent-core.js:18-28
addToShortTerm(message) {
  this.shortTerm.push({
    ...message,
    timestamp: Date.now(),
  });

  // 自动压缩检查
  if (this.shouldCompress()) {
    this.compressMemory();
  }
}

// 压缩触发条件
shouldCompress() {
  return this.shortTerm.length > 50;
}
```

### 2. 记忆压缩

```javascript
// agent-core.js:40-51
compressMemory() {
  const summary = this.generateSummary();
  this.mediumTerm.push({
    type: "compressed_context",
    summary: summary,
    timestamp: Date.now(),
    originalCount: this.shortTerm.length,
  });

  // 保留最近10条消息
  this.shortTerm = this.shortTerm.slice(-10);
}
```

## LLM 集成工作流程

### 1. 任务理解

```javascript
// agent-core.js:139-164
async understandTask(task, context = {}) {
  const prompt = `分析以下任务并提取关键信息：
任务描述：${task}
上下文：${JSON.stringify(context, null, 2)}

请提取：
1. 任务类型
2. 主要目标
3. 所需工具
4. 执行步骤
5. 预期输出

请用JSON格式返回。`;

  try {
    const response = await this.callLLM(prompt);
    return JSON.parse(response);
  } catch (error) {
    // 回退到基础分析
    return {
      type: "general",
      goal: task,
      tools: ["basic"],
      steps: [task],
      output: "text",
    };
  }
}
```

### 2. 工具选择

```javascript
// agent-core.js:209-239
async selectTools(task, availableTools) {
  const prompt = `根据任务选择最适合的工具：
任务：${task}
可用工具：${JSON.stringify(availableTools, null, 2)}

选择最适合的工具组合，并解释原因。`;

  try {
    const response = await this.callLLM(prompt);
    return this.parseToolSelection(response);
  } catch (error) {
    return ["basic"];
  }
}
```

## 事件驱动机制

### 1. 事件定义

```javascript
// work-agent.js:74-90
setupEventHandlers() {
  this.on("task:start", (taskId) => {
    console.log(`任务 ${taskId} 开始执行`);
  });

  this.on("task:complete", (taskId, result) => {
    console.log(`任务 ${taskId} 完成:`, result.summary);
  });

  this.on("task:error", (taskId, error) => {
    console.error(`任务 ${taskId} 失败:`, error);
  });

  this.on("memory:compress", (data) => {
    console.log(`记忆压缩完成，节省 ${data.savedSpace} tokens`);
  });
}
```

## 并发执行机制

### 1. 子代理并发

```javascript
// work-agent.js:425-434
async executeSubTasksConcurrently(tasks, context = {}) {
  const taskInfos = tasks.map((task) => ({
    description: task.description || task.task,
    task: task.task,
    parentId: "main_agent",
    context: { ...context, parentId: "main_agent" },
  }));

  return await this.subAgentManager.executeConcurrent(taskInfos);
}
```

## 实际执行示例流程

### 任务："创建一个包含 hello world 的 test.js 文件"

1. **任务接收**：`agent.execute({task: "创建test.js文件", context: {}})`

2. **任务分析**：

   - 规则引擎识别关键词"创建" → 选择"write"工具
   - LLM 分析确认：{type: "file_creation", tools: ["write"]}

3. **参数解析**：

   - 提取文件名："test.js"
   - 提取内容："hello world"
   - 验证参数：{path: "test.js", content: "hello world"}

4. **工具执行**：

   - 调用 write 工具
   - 执行 fs.writeFile()
   - 返回结果：{success: true, message: "文件写入成功"}

5. **结果汇总**：
   - 生成摘要："成功创建 test.js 文件"
   - 记录到记忆系统
   - 触发完成事件

这个工作流程展示了从自然语言任务到实际执行的完整转换过程，体现了 Work Agent 的核心智能和自动化能力。
