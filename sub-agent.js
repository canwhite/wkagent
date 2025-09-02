/**
 * SubAgent 系统实现
 * 基于course.md架构的I2A子Agent功能
 * 支持并发执行、隔离环境和任务分解
 */

const { EventEmitter } = require("events");
const { AgentMemory, LLMService, ToolRegistry } = require("./agent-core");

/**
 * SubAgent 类
 * 独立的任务执行环境，与主Agent隔离
 */
class SubAgent extends EventEmitter {
  constructor(parentConfig = {}, taskInfo = {}) {
    super();

    this.id = `subagent_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    this.parentId = taskInfo.parentId || "root";
    this.task = taskInfo.task || "";
    this.description = taskInfo.description || "";

    // 独立配置（继承父配置但保持隔离）
    this.config = {
      maxConcurrency: parentConfig.maxConcurrency || 5, // 子Agent并发数更低
      enableLearning: parentConfig.enableLearning || false, // 子Agent不学习
      llm: {
        enableLLM: parentConfig.llm?.enableLLM || false,
        apiKey: parentConfig.llm?.apiKey,
        model: parentConfig.llm?.model || "claude-3-5-sonnet-20241022",
        maxTokens: 1000, // 子Agent限制token
        ...parentConfig.llm,
      },
      timeout: 30000, // 30秒超时
      sandbox: true, // 启用沙箱模式
    };

    // 独立资源
    this.memory = new AgentMemory();
    this.registry = new ToolRegistry();
    this.llmService = null;
    this.startTime = Date.now();
    this.isRunning = false;
    this.abortController = new AbortController();

    // 初始化LLM
    if (this.config.llm.enableLLM) {
      this.llmService = new LLMService(this.config.llm);
    }

    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  setupEventHandlers() {
    this.on("start", () => {
      this.startTime = Date.now();
      this.isRunning = true;
    });

    this.on("complete", (result) => {
      this.isRunning = false;
      this.duration = Date.now() - this.startTime;
    });

    this.on("error", (error) => {
      this.isRunning = false;
      this.error = error;
    });
  }

  /**
   * 执行子任务
   * 基于course.md的I2A函数实现
   */
  async execute(subTask) {
    try {
      this.emit("start", { subAgentId: this.id, task: subTask });

      // 信号检查
      if (this.abortController.signal.aborted) {
        throw new Error("SubAgent执行被中断");
      }

      // 任务分解
      const steps = await this.decomposeTask(subTask);

      // 执行步骤
      const results = await this.executeSteps(steps);

      // 结果汇总
      const summary = await this.summarizeResults(results);

      const finalResult = {
        subAgentId: this.id,
        parentId: this.parentId,
        task: subTask,
        steps: steps,
        results: results,
        summary: summary,
        duration: Date.now() - this.startTime,
        memoryUsage: this.getMemoryUsage(),
        success: true,
      };

      this.emit("complete", finalResult);
      return finalResult;
    } catch (error) {
      const errorResult = {
        subAgentId: this.id,
        parentId: this.parentId,
        task: subTask,
        error: error.message,
        duration: Date.now() - this.startTime,
        success: false,
      };

      this.emit("error", errorResult);
      return errorResult;
    }
  }

  /**
   * 任务分解
   * 将复杂任务分解为可执行的步骤
   */
  async decomposeTask(task) {
    if (this.llmService) {
      try {
        const analysis = await this.llmService.understandTask(task);
        return analysis.steps || [task];
      } catch (error) {
        console.warn("LLM任务分解失败，使用规则分解:", error.message);
      }
    }

    // 规则基础的任务分解
    return this.ruleBasedDecomposition(task);
  }

  /**
   * 基于规则的任务分解
   */
  ruleBasedDecomposition(task) {
    const taskLower = task.toLowerCase();
    const steps = [];

    if (taskLower.includes("分析项目")) {
      steps.push("扫描项目结构");
      steps.push("识别文件类型");
      steps.push("统计代码行数");
      steps.push("生成分析报告");
    } else if (taskLower.includes("重构")) {
      steps.push("分析现有代码");
      steps.push("识别重构点");
      steps.push("创建备份");
      steps.push("执行重构");
      steps.push("验证结果");
    } else if (taskLower.includes("搜索")) {
      steps.push("确定搜索模式");
      steps.push("执行文件搜索");
      steps.push("整理结果");
    } else {
      steps.push(task); // 单步骤任务
    }

    return steps;
  }

  /**
   * 执行步骤
   */
  async executeSteps(steps) {
    const results = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (this.abortController.signal.aborted) {
        throw new Error("SubAgent步骤执行被中断");
      }

      const result = await this.executeStep(step, i + 1, steps.length);
      results.push(result);

      // 记录到内存
      this.memory.addToShortTerm({
        type: "sub_step",
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
  async executeStep(step, stepNumber, totalSteps) {
    const tool = this.selectToolForStep(step);
    const params = this.parseStepParams(step);

    try {
      const validation = this.registry.validateParams(tool, params);
      if (!validation.valid) {
        throw new Error(`参数验证失败: ${validation.error}`);
      }

      const toolDef = this.registry.get(tool);
      const result = await toolDef.execute(params);

      return {
        stepNumber: stepNumber,
        totalSteps: totalSteps,
        step: step,
        tool: tool,
        params: params,
        result: result,
        success: result.success,
        duration: Date.now() - this.startTime,
      };
    } catch (error) {
      return {
        stepNumber: stepNumber,
        totalSteps: totalSteps,
        step: step,
        tool: tool,
        error: error.message,
        success: false,
        duration: Date.now() - this.startTime,
      };
    }
  }

  /**
   * 为步骤选择工具
   */
  selectToolForStep(step) {
    const stepLower = step.toLowerCase();

    if (stepLower.includes("读取") || stepLower.includes("查看")) return "read";
    if (stepLower.includes("创建") || stepLower.includes("写入"))
      return "write";
    if (stepLower.includes("编辑") || stepLower.includes("修改")) return "edit";
    if (stepLower.includes("搜索") || stepLower.includes("查找")) return "grep";
    if (stepLower.includes("执行") || stepLower.includes("运行")) return "bash";
    if (stepLower.includes("匹配") || stepLower.includes("glob")) return "glob";

    return "bash"; // 默认工具
  }

  /**
   * 解析步骤参数
   */
  parseStepParams(step) {
    const params = {};
    const stepLower = step.toLowerCase();

    // 智能参数解析
    if (
      stepLower.includes("文件") ||
      stepLower.includes(".txt") ||
      stepLower.includes(".js")
    ) {
      const fileMatch = step.match(/[\w\/\\.-]+\.\w+/g);
      params.path = fileMatch ? fileMatch[0] : "./output.txt";
    }

    if (stepLower.includes("搜索") || stepLower.includes("查找")) {
      const patternMatch = step.match(/["']([^"']+)["']/g);
      params.pattern = patternMatch ? patternMatch[0].slice(1, -1) : "function";
    }

    if (stepLower.includes("执行") || stepLower.includes("运行")) {
      const commandMatch = step.match(/执行\s+(.+)|运行\s+(.+)/);
      params.command = commandMatch ? commandMatch[1] || commandMatch[2] : "ls";
    }

    return params;
  }

  /**
   * 汇总结果
   */
  async summarizeResults(results) {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    let summary = `子Agent ${this.id} 完成任务: ${this.task}. `;
    summary += `共 ${results.length} 个步骤, ${successful.length} 个成功`;

    if (failed.length > 0) {
      summary += `, ${failed.length} 个失败`;
    }

    if (this.llmService) {
      try {
        const prompt = `为以下子Agent执行结果生成简洁总结：
任务：${this.task}
步骤：${results.map((r) => `${r.stepNumber}. ${r.step}`).join("\n")}
成功：${successful.length}/${results.length}

请提供50字以内的总结。`;

        const llmSummary = await this.llmService.callLLM(prompt);
        return llmSummary || summary;
      } catch (error) {
        return summary;
      }
    }

    return summary;
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage() {
    return {
      shortTerm: this.memory.shortTerm.length,
      mediumTerm: this.memory.mediumTerm.length,
      totalMessages:
        this.memory.shortTerm.length + this.memory.mediumTerm.length,
    };
  }

  /**
   * 中断执行
   */
  abort() {
    this.abortController.abort();
    this.isRunning = false;
    this.emit("aborted", { subAgentId: this.id });
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      id: this.id,
      parentId: this.parentId,
      task: this.task,
      isRunning: this.isRunning,
      duration: this.isRunning ? Date.now() - this.startTime : this.duration,
      memoryUsage: this.getMemoryUsage(),
      config: {
        maxConcurrency: this.config.maxConcurrency,
        timeout: this.config.timeout,
        sandbox: this.config.sandbox,
      },
    };
  }
}

/**
 * SubAgent管理器
 * 管理多个SubAgent实例的创建和调度
 */
class SubAgentManager extends EventEmitter {
  constructor(parentConfig = {}) {
    super();
    this.parentConfig = parentConfig;
    this.subAgents = new Map();
    this.maxSubAgents = parentConfig.maxSubAgents || 10;
    this.activeSubAgents = 0;
  }

  /**
   * 创建SubAgent
   */
  createSubAgent(taskInfo) {
    if (this.activeSubAgents >= this.maxSubAgents) {
      throw new Error(`已达到最大SubAgent数量限制: ${this.maxSubAgents}`);
    }

    const subAgent = new SubAgent(this.parentConfig, taskInfo);
    this.subAgents.set(subAgent.id, subAgent);
    this.activeSubAgents++;

    // 监听SubAgent事件
    subAgent.on("start", (data) => {
      this.emit("subAgent:start", data);
    });

    subAgent.on("complete", (result) => {
      this.subAgents.delete(subAgent.id);
      this.activeSubAgents--;
      this.emit("subAgent:complete", result);
    });

    subAgent.on("error", (error) => {
      this.subAgents.delete(subAgent.id);
      this.activeSubAgents--;
      this.emit("subAgent:error", error);
    });

    subAgent.on("aborted", (data) => {
      this.subAgents.delete(subAgent.id);
      this.activeSubAgents--;
      this.emit("subAgent:aborted", data);
    });

    return subAgent;
  }

  /**
   * 批量创建SubAgent
   */
  async createSubAgents(tasks) {
    const subAgents = [];

    for (const task of tasks) {
      try {
        const subAgent = this.createSubAgent(task);
        subAgents.push(subAgent);
      } catch (error) {
        console.warn("创建SubAgent失败:", error.message);
      }
    }

    return subAgents;
  }

  /**
   * 并发执行多个子任务
   */
  async executeConcurrent(tasks) {
    const subAgents = await this.createSubAgents(tasks);

    const promises = subAgents.map((subAgent) =>
      subAgent.execute(subAgent.task)
    );

    return Promise.allSettled(promises);
  }

  /**
   * 获取所有SubAgent状态
   */
  getStatus() {
    const statuses = [];
    for (const [id, subAgent] of this.subAgents) {
      statuses.push(subAgent.getStatus());
    }

    return {
      totalSubAgents: this.activeSubAgents,
      maxSubAgents: this.maxSubAgents,
      subAgents: statuses,
    };
  }

  /**
   * 中断所有SubAgent
   */
  abortAll() {
    for (const [id, subAgent] of this.subAgents) {
      subAgent.abort();
    }
  }
}

/**
 * Task工具
 * 创建SubAgent的便捷接口
 */
class TaskTool {
  constructor(parentConfig = {}) {
    this.manager = new SubAgentManager(parentConfig);
  }

  /**
   * 执行Task（兼容主Agent接口）
   */
  async execute(description, prompt, parentContext = {}) {
    const taskInfo = {
      description: description,
      task: prompt,
      parentId: parentContext.parentId || "root",
      context: parentContext,
    };

    const subAgent = this.manager.createSubAgent(taskInfo);
    return await subAgent.execute(prompt);
  }

  /**
   * 批量执行Task
   */
  async executeBatch(tasks, parentContext = {}) {
    const taskInfos = tasks.map((task) => ({
      description: task.description || task.task,
      task: task.task,
      parentId: parentContext.parentId || "root",
      context: { ...parentContext, ...task.context },
    }));

    return await this.manager.executeConcurrent(taskInfos);
  }
}

module.exports = {
  SubAgent,
  SubAgentManager,
  TaskTool,
};
