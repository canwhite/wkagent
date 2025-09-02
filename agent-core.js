/**
 * 基于course.md架构的JS Agent系统核心实现
 * 包含LLM增强智能决策能力
 */

require('dotenv').config();

class AgentMemory {
  constructor() {
    this.shortTerm = []; // 短期记忆：当前会话
    this.mediumTerm = []; // 中期记忆：压缩上下文
    this.longTerm = {}; // 长期记忆：项目配置
  }

  /**
   * 添加消息到短期记忆
   */
  addToShortTerm(message) {
    this.shortTerm.push({
      ...message,
      timestamp: Date.now(),
    });

    // 检查是否需要压缩
    if (this.shouldCompress()) {
      this.compressMemory();
    }
  }

  /**
   * 判断是否需要压缩记忆
   */
  shouldCompress() {
    return this.shortTerm.length > 50; // 简单阈值判断
  }

  /**
   * 压缩短期记忆到中期记忆
   */
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

  /**
   * 生成记忆摘要
   */
  generateSummary() {
    const topics = this.extractTopics();
    const decisions = this.extractDecisions();

    return {
      topics: topics,
      decisions: decisions,
      timestamp: Date.now(),
      messageCount: this.shortTerm.length,
    };
  }

  /**
   * 提取主题
   */
  extractTopics() {
    const messages = this.shortTerm;
    const topics = [];

    messages.forEach((msg) => {
      if (msg.content) {
        const words = msg.content.toLowerCase().split(/\s+/);
        words.forEach((word) => {
          if (word.length > 3 && !topics.includes(word)) {
            topics.push(word);
          }
        });
      }
    });

    return topics.slice(0, 10);
  }

  /**
   * 提取决策
   */
  extractDecisions() {
    return this.shortTerm
      .filter((msg) => msg.type === "decision")
      .map((msg) => msg.content);
  }
}

/**
 * LLM服务集成 - DeepSeek API
 */
class LLMService {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY;
    this.baseURL = config.baseURL || "https://api.deepseek.com";
    this.model = config.model || "deepseek-chat";
    this.maxTokens = config.maxTokens || 4000;
    this.temperature = config.temperature || 0.3;
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: "user", content: "ping" }],
          stream: false
        }),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 理解任务
   */
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
      return {
        type: "general",
        goal: task,
        tools: ["basic"],
        steps: [task],
        output: "text",
      };
    }
  }

  /**
   * 调用LLM
   */
  async callLLM(prompt, systemPrompt = "") {
    try {
      const messages = [];
      
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          messages: messages,
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error("LLM调用失败:", error);
      throw error;
    }
  }

  /**
   * 智能工具选择
   */
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

  /**
   * 解析工具选择结果
   */
  parseToolSelection(response) {
    // 简单解析，实际应用中需要更复杂的解析逻辑
    const tools = ["read", "write", "edit", "bash", "glob", "grep"];
    const selected = [];

    tools.forEach((tool) => {
      if (response.toLowerCase().includes(tool)) {
        selected.push(tool);
      }
    });

    return selected.length > 0 ? selected : ["basic"];
  }
}

/**
 * 工具注册器
 */
class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.initializeDefaultTools();
  }

  /**
   * 初始化默认工具
   */
  initializeDefaultTools() {
    this.register("read", {
      name: "read",
      description: "读取文件内容",
      execute: async (params) => {
        const fs = require("fs").promises;
        try {
          const content = await fs.readFile(params.path, "utf-8");
          return { success: true, content, type: "file_content" };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        path: { type: "string", required: true, description: "文件路径" },
      },
    });

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

    this.register("edit", {
      name: "edit",
      description: "编辑文件内容",
      execute: async (params) => {
        const fs = require("fs").promises;
        try {
          let content = await fs.readFile(params.path, "utf-8");
          content = content.replace(params.oldString, params.newString);
          await fs.writeFile(params.path, content, "utf-8");
          return { success: true, message: "文件编辑成功" };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        path: { type: "string", required: true, description: "文件路径" },
        oldString: {
          type: "string",
          required: true,
          description: "要替换的字符串",
        },
        newString: { type: "string", required: true, description: "新字符串" },
      },
    });

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

    this.register("glob", {
      name: "glob",
      description: "文件模式匹配",
      execute: async (params) => {
        const glob = require("glob");
        const util = require("util");
        const globAsync = util.promisify(glob);

        try {
          const files = await globAsync(params.pattern, {
            cwd: params.cwd || ".",
          });
          return { success: true, files, type: "file_list" };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        pattern: { type: "string", required: true, description: "匹配模式" },
        cwd: { type: "string", required: false, description: "工作目录" },
      },
    });

    this.register("grep", {
      name: "grep",
      description: "文件内容搜索",
      execute: async (params) => {
        const fs = require("fs").promises;
        const path = require("path");

        try {
          const glob = require("glob");
          const util = require("util");
          const globAsync = util.promisify(glob);

          const files = await globAsync(params.files || "**/*", {
            cwd: params.cwd || ".",
          });
          const results = [];

          for (const file of files) {
            try {
              const content = await fs.readFile(
                path.resolve(params.cwd || ".", file),
                "utf-8"
              );
              const lines = content.split("\n");

              lines.forEach((line, index) => {
                if (line.includes(params.pattern)) {
                  results.push({
                    file: file,
                    line: index + 1,
                    content: line.trim(),
                  });
                }
              });
            } catch (error) {
              // 忽略无法读取的文件
            }
          }

          return { success: true, results, type: "search_results" };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        pattern: { type: "string", required: true, description: "搜索模式" },
        files: { type: "string", required: false, description: "文件模式" },
        cwd: { type: "string", required: false, description: "工作目录" },
      },
    });
  }

  /**
   * 注册工具
   */
  register(name, tool) {
    this.tools.set(name, tool);
  }

  /**
   * 获取工具
   */
  get(name) {
    return this.tools.get(name);
  }

  /**
   * 获取所有可用工具
   */
  getAll() {
    return Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      description: tool.description,
    }));
  }

  /**
   * 验证工具参数
   */
  validateParams(toolName, params) {
    const tool = this.get(toolName);
    if (!tool) return { valid: false, error: "工具不存在" };

    const schema = tool.schema;
    for (const [key, config] of Object.entries(schema)) {
      if (config.required && !params[key]) {
        return { valid: false, error: `缺少必需参数: ${key}` };
      }
    }

    return { valid: true };
  }
}

module.exports = {
  AgentMemory,
  LLMService,
  ToolRegistry,
};
