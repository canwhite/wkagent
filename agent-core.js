/**
 * 基于course.md架构的JS Agent系统核心实现
 * 包含LLM增强智能决策能力
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const JSONParser = require("./utils/json-parser");

/**
 * Enhanced Memory System based on Claude Workflow 3-tier architecture
 * Provides backward compatibility with original AgentMemory interface
 */
class AgentMemory {
  constructor() {
    this.enhancedMemory =
      new (require("./enhanced-memory").EnhancedAgentMemory)();
  }

  /**
   * 添加消息到短期记忆（向后兼容）
   */
  addToShortTerm(message) {
    this.enhancedMemory.addMessage(message);
  }

  /**
   * 判断是否需要压缩记忆
   */
  shouldCompress() {
    return this.enhancedMemory.shouldCompress();
  }

  /**
   * 压缩短期记忆到中期记忆
   */
  compressMemory() {
    this.enhancedMemory.compressMemory();
  }

  /**
   * 生成记忆摘要
   */
  generateSummary() {
    return this.enhancedMemory.generateStructuredSummary();
  }

  /**
   * 提取主题
   */
  extractTopics() {
    return this.enhancedMemory.extractKeyTopics().map((t) => t.topic);
  }

  /**
   * 提取决策
   */
  extractDecisions() {
    return this.enhancedMemory.extractKeyDecisions().map((d) => d.content);
  }

  /**
   * 获取底层增强内存实例
   */
  getEnhancedMemory() {
    return this.enhancedMemory;
  }

  /**
   * 获取LLM上下文
   */
  getLLMContext(maxTokens = 4000) {
    return this.enhancedMemory.getLLMContext(maxTokens);
  }

  /**
   * 获取状态信息
   */
  getStatus() {
    return this.enhancedMemory.getStatus();
  }

  // 保持向后兼容的属性访问
  get shortTerm() {
    return this.enhancedMemory.shortTerm;
  }

  get mediumTerm() {
    return this.enhancedMemory.mediumTerm;
  }

  get longTerm() {
    return this.enhancedMemory.longTerm;
  }

  set shortTerm(value) {
    this.enhancedMemory.shortTerm = value;
  }

  set mediumTerm(value) {
    this.enhancedMemory.mediumTerm = value;
  }

  set longTerm(value) {
    this.enhancedMemory.longTerm = value;
  }
}

/**
 * 安全工具 - 敏感信息处理
 */
class SecurityLogger {
  static sanitizeError(error) {
    if (typeof error !== "string") {
      error = error.message || error.toString();
    }

    // 移除API密钥等敏感信息
    const sensitivePatterns = [
      /api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9]{20,}['"]?/gi,
      /token\s*[:=]\s*['"]?[a-zA-Z0-9]{20,}['"]?/gi,
      /password\s*[:=]\s*['"]?[^'"\s]+['"]?/gi,
      /secret\s*[:=]\s*['"]?[^'"\s]+['"]?/gi,
      /bearer\s+[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/gi,
    ];

    let sanitized = error;
    sensitivePatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    });

    return sanitized;
  }

  static sanitizeObject(obj) {
    const sanitized = JSON.parse(JSON.stringify(obj));
    const sensitiveKeys = [
      "apiKey",
      "api_key",
      "token",
      "password",
      "secret",
      "auth",
    ];

    function sanitizeRecursive(target) {
      if (typeof target === "object" && target !== null) {
        Object.keys(target).forEach((key) => {
          if (
            sensitiveKeys.some((sensitive) =>
              key.toLowerCase().includes(sensitive)
            )
          ) {
            target[key] = "[REDACTED]";
          } else if (typeof target[key] === "object") {
            sanitizeRecursive(target[key]);
          }
        });
      }
    }

    sanitizeRecursive(sanitized);
    return sanitized;
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
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: "user", content: "ping" }],
          stream: false,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error("LLM健康检查失败:", SecurityLogger.sanitizeError(error));
      return false;
    }
  }

  /**
   * 理解任务
   */
  /**
   * 解析降级响应
   */
  parseFallbackResponse(response) {
    // 从文本中提取关键信息
    const lines = response.split('\n').filter(line => line.trim());
    
    const typeMatch = response.match(/任务类型[:：]\s*(.+)/i);
    const goalMatch = response.match(/主要目标[:：]\s*(.+)/i);
    const toolsMatch = response.match(/所需工具[:：]\s*(.+)/i);
    
    return {
      type: typeMatch ? typeMatch[1].trim() : "general",
      goal: goalMatch ? goalMatch[1].trim() : "",
      tools: toolsMatch ? toolsMatch[1].split(',').map(t => t.trim()) : ["basic"],
      steps: ["task"],
      output: "text",
    };
  }

  /**
   * 获取JSON格式的LLM响应
   */
  async getJSONResponse(prompt, schema = null) {
    const enhancedPrompt = `${prompt}

请以严格的JSON格式返回结果，不要包含任何解释文字或其他格式。`;
    
    try {
      const response = await this.callLLM(enhancedPrompt);
      const parsed = JSONParser.extractJSON(response);
      
      if (parsed) {
        return { success: true, data: parsed };
      }
      
      return { success: false, error: "无法从响应中提取有效JSON", raw: response };
    } catch (error) {
      return { success: false, error: error.message };
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
      const parsed = JSONParser.extractJSON(response);
      if (parsed) {
        return parsed;
      }
      
      // 降级处理：尝试手动解析
      const fallback = this.parseFallbackResponse(response);
      return fallback;
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
   * 调用LLM（带重试机制）
   */
  async callLLM(prompt, systemPrompt = "", maxRetries = 3, delay = 1000) {
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
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          messages: messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      const sanitizedError = SecurityLogger.sanitizeError(error);

      if (maxRetries > 0) {
        console.warn(
          `LLM调用失败，${maxRetries}次重试后重试...`,
          sanitizedError
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.callLLM(prompt, systemPrompt, maxRetries - 1, delay * 2);
      }

      console.error("LLM调用最终失败:", sanitizedError);

      // 提供更友好的错误信息
      if (error.message?.includes("401")) {
        throw new Error("LLM认证失败，请检查API密钥是否正确");
      } else if (error.message?.includes("429")) {
        throw new Error("LLM服务请求过于频繁，请稍后重试");
      } else if (
        error.message?.includes("network") ||
        error.message?.includes("fetch")
      ) {
        throw new Error("网络连接失败，请检查网络配置");
      } else {
        throw new Error("LLM服务暂时不可用，请稍后重试");
      }
    }
  }

  /**
   * 智能工具选择
   */
  async selectTools(task, availableTools) {
    const prompt = `你是一个工具选择专家，请根据任务描述选择最适合的工具。

任务：${task}
可用工具：${JSON.stringify(availableTools, null, 2)}

工具说明：
- read: 读取文件内容
- write: 写入文件内容  
- edit: 编辑文件内容
- bash: 执行系统命令
- grep: 搜索文件内容
- glob: 文件模式匹配

请根据任务类型选择最适合的工具。只需返回工具名称，例如：["bash"]

任务分析：
- 如果涉及创建或写入文件：选择 "write"
- 如果涉及读取文件：选择 "read"
- 如果涉及执行命令：选择 "bash"
- 如果涉及搜索：选择 "grep"
- 如果涉及列出文件：选择 "glob"

直接返回JSON格式：["工具名称"]`;

    try {
      const response = await this.callLLM(prompt);
      //TODO: 需要优化,这只是临时方案,实际应用中需要更复杂的解析逻辑
      const match = response.match(/\[("[^"]*")\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
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
 * 安全工具 - 路径验证和清理
 */
class SecurityUtils {
  static validatePath(inputPath, basePath = process.cwd()) {
    // 清理和规范化路径
    const normalizedPath = path.normalize(inputPath);
    const resolvedPath = path.resolve(basePath, normalizedPath);

    // 确保路径在允许的基目录内
    const relative = path.relative(basePath, resolvedPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("路径不允许访问父目录或系统路径");
    }

    // 检查文件是否存在及权限
    try {
      fs.accessSync(resolvedPath, fs.constants.F_OK);
    } catch (error) {
      // 如果是写入操作，检查目录权限
      const dir = path.dirname(resolvedPath);
      try {
        fs.accessSync(dir, fs.constants.W_OK);
      } catch (dirError) {
        throw new Error("没有权限访问指定路径");
      }
    }

    return resolvedPath;
  }

  static sanitizeFilename(filename) {
    // 移除危险字符
    return filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  }

  static isSafePath(inputPath) {
    try {
      this.validatePath(inputPath);
      return true;
    } catch (error) {
      return false;
    }
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
      description: "安全读取文件内容",
      execute: async (params) => {
        const fs = require("fs").promises;
        try {
          const safePath = SecurityUtils.validatePath(params.path);
          const content = await fs.readFile(safePath, "utf-8");
          return {
            success: true,
            content,
            type: "file_content",
            path: safePath,
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        path: {
          type: "string",
          required: true,
          description: "文件路径（相对路径或工作目录内路径）",
        },
      },
    });

    this.register("write", {
      name: "write",
      description: "安全写入文件内容",
      execute: async (params) => {
        const fs = require("fs").promises;
        try {
          const safePath = SecurityUtils.validatePath(params.path);
          const safeContent = params.content || "";

          // 检查文件大小限制（10MB）
          const contentSize = Buffer.byteLength(safeContent, "utf8");
          if (contentSize > 10 * 1024 * 1024) {
            return { success: false, error: "文件内容超过10MB限制" };
          }

          await fs.writeFile(safePath, safeContent, "utf-8");
          return { success: true, message: "文件写入成功", path: safePath };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        path: {
          type: "string",
          required: true,
          description: "文件路径（相对路径或工作目录内路径）",
        },
        content: { type: "string", required: true, description: "文件内容" },
      },
    });

    this.register("edit", {
      name: "edit",
      description: "安全编辑文件内容",
      execute: async (params) => {
        const fs = require("fs").promises;
        try {
          const safePath = SecurityUtils.validatePath(params.path);

          // 检查文件大小限制
          const stats = await fs.stat(safePath);
          if (stats.size > 10 * 1024 * 1024) {
            return { success: false, error: "文件超过10MB限制" };
          }

          let content = await fs.readFile(safePath, "utf-8");

          // 限制替换操作的范围
          if (params.oldString.length === 0) {
            return { success: false, error: "oldString不能为空" };
          }

          // 检查替换后的文件大小
          const newContent = content.replace(
            params.oldString,
            params.newString
          );
          const newSize = Buffer.byteLength(newContent, "utf8");
          if (newSize > 10 * 1024 * 1024) {
            return { success: false, error: "替换后文件超过10MB限制" };
          }

          await fs.writeFile(safePath, newContent, "utf-8");
          return { success: true, message: "文件编辑成功", path: safePath };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        path: {
          type: "string",
          required: true,
          description: "文件路径（相对路径或工作目录内路径）",
        },
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
      description: "执行安全的bash命令",
      execute: async (params) => {
        const { spawn } = require("child_process");

        // 命令白名单和参数验证
        const allowedCommands = new Set([
          "ls",
          "cat",
          "pwd",
          "echo",
          "grep",
          "find",
          "head",
          "tail",
          "wc",
          "sort",
          "uniq",
        ]);

        try {
          // 解析命令，只允许简单命令
          const parts = params.command.trim().split(/\s+/);
          const cmd = parts[0];
          const args = parts.slice(1);

          if (!allowedCommands.has(cmd)) {
            return {
              success: false,
              error: `命令 '${cmd}' 不在允许列表中`,
            };
          }

          // 验证参数不包含危险字符
          const dangerousChars = /[;&|`$(){}[\]<>]/;
          for (const arg of args) {
            if (dangerousChars.test(arg)) {
              return {
                success: false,
                error: `参数包含危险字符: ${arg}`,
              };
            }
          }

          return new Promise((resolve) => {
            const child = spawn(cmd, args, {
              stdio: "pipe",
              cwd: process.cwd(),
              env: { ...process.env, PATH: process.env.PATH },
            });

            let stdout = "";
            let stderr = "";

            child.stdout.on("data", (data) => {
              stdout += data.toString();
            });
            child.stderr.on("data", (data) => {
              stderr += data.toString();
            });

            child.on("close", (code) => {
              resolve({
                success: code === 0,
                output: stdout,
                error: stderr,
                exitCode: code,
                type: "command_output",
              });
            });

            // 超时保护
            setTimeout(() => {
              child.kill();
              resolve({
                success: false,
                error: "命令执行超时（30秒）",
              });
            }, 30000);
          });
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        command: {
          type: "string",
          required: true,
          description: "要执行的命令（限白名单命令）",
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
