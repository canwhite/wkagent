/**
 * Work Agent主类
 * 基于course.md架构的JS Agent系统主实现
 */

const { AgentMemory, LLMService, ToolRegistry } = require("./agent-core");
const { SubAgentManager, TaskTool } = require("./sub-agent");
const EventEmitter = require("events");

class WkAgent extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      enableLearning: true,
      maxConcurrency: 10,
      llm: {
        enableLLM: false,
        apiKey: process.env.CLAUDE_API_KEY,
        confidenceThreshold: 0.8,
        ...config.llm,
      },
      ...config,
    };

    this.memory = new AgentMemory();
    this.registry = new ToolRegistry();
    this.llmService = null;
    this.activeTasks = new Map();
    this.taskId = 0;

    // 初始化LLM服务
    if (this.config.llm.enableLLM) {
      this.llmService = new LLMService(this.config.llm);
    }

    // 初始化SubAgent管理器
    this.subAgentManager = new SubAgentManager(this.config);
    this.taskTool = new TaskTool(this.config);

    // 注册Task工具
    this.registry.register("task", {
      name: "task",
      description: "创建并执行SubAgent任务",
      execute: async (params) => {
        try {
          const result = await this.taskTool.execute(
            params.description,
            params.prompt,
            params.context
          );
          return { success: true, result, type: "sub_agent_result" };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        description: {
          type: "string",
          required: true,
          description: "任务简短描述",
        },
        prompt: { type: "string", required: true, description: "详细任务指令" },
        context: { type: "object", required: false, description: "执行上下文" },
      },
    });

    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
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

  /**
   * 执行主任务
   */
  async execute(request) {
    const taskId = `task_${++this.taskId}`;

    try {
      this.emit("task:start", taskId);

      // 记录任务到内存
      this.memory.addToShortTerm({
        type: "task_request",
        content: request.task,
        context: request.context,
        taskId: taskId,
        timestamp: Date.now(),
      });

      // 任务理解和分解
      const taskAnalysis = await this.analyzeTask(request);

      // 执行分解后的子任务
      const results = await this.executeSubTasks(taskAnalysis, request.context);

      // 汇总结果
      const summary = await this.summarizeResults(results, taskAnalysis);

      this.emit("task:complete", taskId, summary);

      return {
        taskId,
        summary: summary,
        results: results,
        metadata: {
          duration:
            Date.now() -
            this.memory.shortTerm[this.memory.shortTerm.length - 1].timestamp,
          toolsUsed: results.map((r) => r.tool).filter(Boolean),
          llmUsed: this.config.llm.enableLLM,
        },
      };
    } catch (error) {
      this.emit("task:error", taskId, error);
      throw error;
    }
  }

  /**
   * 分析任务
   */
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
        console.warn("LLM分析失败，使用规则引擎:", error.message);
        return this.ruleBasedAnalysis(request.task);
      }
    } else {
      return this.ruleBasedAnalysis(request.task);
    }
  }

  /**
   * 基于规则的任务分析
   */
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

  /**
   * 执行子任务
   */
  async executeSubTasks(taskAnalysis, context) {
    const results = [];

    for (const step of taskAnalysis.steps) {
      const result = await this.executeStep(step, taskAnalysis.tools, context);
      results.push(result);

      // 记录执行结果
      this.memory.addToShortTerm({
        type: "task_result",
        step: step,
        result: result,
        timestamp: Date.now(),
      });
    }

    return results;
  }

  /**
   * 执行单个步骤
   */
  async executeStep(step, preferredTools, context) {
    let tools = preferredTools;

    // 如果启用了LLM，使用LLM选择工具
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

    // 选择最适合的工具
    const tool = this.selectBestTool(step, tools);
    if (!tool) {
      return {
        success: false,
        error: "没有合适的工具可用",
        step: step,
      };
    }

    // 解析参数
    const params = this.parseToolParams(step, tool, context);

    // 验证参数
    const validation = this.registry.validateParams(tool, params);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        step: step,
      };
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

  /**
   * 选择最适合的工具
   */
  selectBestTool(step, preferredTools) {
    const availableTools = this.registry.getAll();

    // 优先使用推荐工具
    for (const tool of preferredTools) {
      if (availableTools.find((t) => t.name === tool)) {
        return tool;
      }
    }

    // 基于关键词匹配 - 更智能的匹配
    const stepLower = step.toLowerCase();

    // 文件操作
    if (stepLower.includes("创建") || stepLower.includes("写入") || stepLower.includes("生成")) {
      return "write";
    }
    if (stepLower.includes("读取") || stepLower.includes("查看") || stepLower.includes("打开")) {
      return "read";
    }
    if (stepLower.includes("编辑") || stepLower.includes("修改") || stepLower.includes("更新")) {
      return "edit";
    }
    
    // 命令执行
    if (stepLower.includes("执行") || stepLower.includes("运行") || stepLower.includes("启动")) {
      return "bash";
    }
    
    // 搜索操作
    if (stepLower.includes("搜索") || stepLower.includes("查找") || stepLower.includes("匹配")) {
      return "grep";
    }
    if (stepLower.includes("列出") || stepLower.includes("显示所有")) {
      return "glob";
    }

    return null;
  }

  /**
   * 解析工具参数
   */
  parseToolParams(step, tool, context) {
    const params = {};

    switch (tool) {
      case "read":
        params.path = context.filePath || this.extractFilePath(step) || context.projectPath;
        break;

      case "write":
        params.path = context.filePath || context.outputFile || context.serverFile || context.outputPath || "output.txt";
        params.content = context.content || context.code || step.replace(/创建|写入/g, "").trim();
        break;

      case "edit":
        params.path = context.filePath || this.extractFilePath(step);
        if (context.oldString && context.newString) {
          params.oldString = context.oldString;
          params.newString = context.newString;
        } else {
          const editMatch = step.match(/将(.+?)替换为(.+)/);
          if (editMatch) {
            params.oldString = editMatch[1].trim();
            params.newString = editMatch[2].trim();
          }
        }
        break;

      case "bash":
        params.command = context.command || step.replace(/执行|运行/g, "").trim();
        // 确保有默认路径
        if (!params.command) {
          params.command = "echo 'no command provided'";
        }
        break;

      case "grep":
        params.pattern = context.pattern || this.extractPattern(step);
        params.cwd = context.projectPath || ".";
        params.files = context.files;
        break;

      case "glob":
        params.pattern = context.pattern || this.extractPattern(step) || "**/*";
        params.cwd = context.projectPath || ".";
        break;
    }

    return params;
  }

  /**
   * 提取文件路径
   */
  extractFilePath(text) {
    const pathMatch = text.match(/[\w\/\\.-]+\.\w+/g);
    return pathMatch ? pathMatch[0] : null;
  }

  /**
   * 提取模式
   */
  extractPattern(text) {
    const patternMatch = text.match(/["']([^"']+)["']/g);
    return patternMatch ? patternMatch[0].slice(1, -1) : null;
  }

  /**
   * 汇总结果
   */
  async summarizeResults(results, taskAnalysis) {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    let summary = `任务执行完成。`;

    if (successful.length > 0) {
      summary += `成功执行 ${successful.length} 个步骤，使用工具: ${successful
        .map((r) => r.tool)
        .join(", ")}。`;
    }

    if (failed.length > 0) {
      summary += `${failed.length} 个步骤失败。`;
    }

    // 使用LLM生成更详细的总结
    if (this.llmService && this.config.llm.enableLLM) {
      try {
        const prompt = `总结以下任务执行结果：
原始任务：${taskAnalysis.originalTask}
执行步骤：${JSON.stringify(results, null, 2)}

请提供一个简洁的总结。`;

        const llmSummary = await this.llmService.callLLM(prompt);
        summary = llmSummary || summary;
      } catch (error) {
        console.warn("LLM总结生成失败:", error.message);
      }
    }

    return summary;
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      memory: {
        shortTerm: this.memory.shortTerm.length,
        mediumTerm: this.memory.mediumTerm.length,
        longTerm: Object.keys(this.memory.longTerm).length,
      },
      activeTasks: this.activeTasks.size,
      llmEnabled: this.config.llm.enableLLM,
      tools: this.registry.getAll().length,
      subAgents: this.subAgentManager.getStatus(),
    };
  }

  /**
   * 并发执行多个子任务
   */
  async executeSubTasksConcurrently(tasks, context = {}) {
    const taskInfos = tasks.map((task) => ({
      description: task.description || task.task,
      task: task.task,
      parentId: "main_agent",
      context: { ...context, parentId: "main_agent" },
    }));

    return await this.subAgentManager.executeConcurrent(taskInfos);
  }

  /**
   * 创建SubAgent
   */
  createSubAgent(taskInfo) {
    return this.subAgentManager.createSubAgent(taskInfo);
  }

  /**
   * 获取SubAgent状态
   */
  getSubAgentStatus() {
    return this.subAgentManager.getStatus();
  }

  /**
   * 中断所有SubAgent
   */
  abortAllSubAgents() {
    this.subAgentManager.abortAll();
  }

  /**
   * 清理内存
   */
  cleanup() {
    this.memory.shortTerm = [];
    this.memory.mediumTerm = [];
    this.activeTasks.clear();
  }

  /**
   * 添加自定义工具
   */
  addTool(name, tool) {
    this.registry.register(name, tool);
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools() {
    return this.registry.getAll();
  }
}

module.exports = WkAgent;
