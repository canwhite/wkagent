/**
 * 浏览器环境的Agent实现
 */

const EnvironmentDetector = require('./environment-detector');
const { BrowserFileSystem, BrowserProcess, BrowserPath, BrowserStorage } = require('./browser-adapters');

// 创建浏览器版本的Agent
class BrowserWkAgent {
  constructor(config = {}) {
    this.config = {
      enableLearning: true,
      maxConcurrency: 5, // 浏览器环境降低并发
      llm: {
        enableLLM: false,
        ...config.llm,
      },
      ...config,
    };

    // 浏览器环境适配
    this.fs = new BrowserFileSystem();
    this.path = BrowserPath;
    this.process = new BrowserProcess();
    this.storage = new BrowserStorage();
    
    // 内存管理
    this.memory = new BrowserMemory();
    this.activeTasks = new Map();
    this.taskId = 0;

    // 工具注册
    this.registry = new BrowserToolRegistry();
    this.setupTools();
  }

  setupTools() {
    // 注册浏览器环境的工具
    this.registry.register('read', {
      name: 'read',
      description: '读取文件内容',
      execute: async (params) => {
        try {
          const content = await this.fs.readFile(params.path);
          return {
            success: true,
            content,
            type: 'file_content',
            path: params.path,
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        path: { type: 'string', required: true, description: '文件路径' },
      },
    });

    this.registry.register('write', {
      name: 'write',
      description: '写入文件内容',
      execute: async (params) => {
        try {
          const result = await this.fs.writeFile(params.path, params.content);
          return { success: true, message: '文件写入成功', path: params.path };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        path: { type: 'string', required: true, description: '文件路径' },
        content: { type: 'string', required: true, description: '文件内容' },
      },
    });

    this.registry.register('storage', {
      name: 'storage',
      description: '浏览器存储操作',
      execute: async (params) => {
        try {
          const { operation, key, value } = params;
          switch (operation) {
            case 'set':
              await this.storage.setItem(key, value);
              return { success: true, message: '存储成功' };
            case 'get':
              const result = await this.storage.getItem(key);
              return { success: true, data: result };
            case 'remove':
              await this.storage.removeItem(key);
              return { success: true, message: '删除成功' };
            default:
              return { success: false, error: '不支持的操作' };
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        operation: { type: 'string', required: true, description: '操作类型: set/get/remove' },
        key: { type: 'string', required: true, description: '存储键' },
        value: { type: 'string', required: false, description: '存储值' },
      },
    });

    this.registry.register('fetch', {
      name: 'fetch',
      description: '网络请求',
      execute: async (params) => {
        try {
          const response = await fetch(params.url, {
            method: params.method || 'GET',
            headers: params.headers || {},
            body: params.body,
          });
          
          const data = await response.text();
          return {
            success: response.ok,
            data,
            status: response.status,
            headers: Object.fromEntries(response.headers),
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      schema: {
        url: { type: 'string', required: true, description: '请求URL' },
        method: { type: 'string', required: false, description: '请求方法' },
        headers: { type: 'object', required: false, description: '请求头' },
        body: { type: 'string', required: false, description: '请求体' },
      },
    });
  }

  async execute(request) {
    const taskId = `task_${++this.taskId}`;
    
    try {
      // 记录任务
      this.memory.addTask({
        type: 'task_request',
        content: request.task,
        context: request.context,
        taskId,
        timestamp: Date.now(),
      });

      // 简单任务分析
      const taskAnalysis = this.analyzeTask(request.task);
      
      // 执行任务
      const results = await this.executeSteps(taskAnalysis, request.context);
      
      // 汇总结果
      const summary = await this.summarizeResults(results, taskAnalysis);
      
      return {
        taskId,
        summary,
        results,
        metadata: {
          duration: Date.now() - this.memory.getTaskTimestamp(taskId),
          toolsUsed: results.map(r => r.tool).filter(Boolean),
        },
      };
    } catch (error) {
      return { success: false, error: error.message, taskId };
    }
  }

  analyzeTask(task) {
    const keywords = {
      '创建': ['write'],
      '读取': ['read'],
      '存储': ['storage'],
      '请求': ['fetch'],
    };

    const taskLower = task.toLowerCase();
    const tools = [];

    Object.entries(keywords).forEach(([keyword, toolList]) => {
      if (taskLower.includes(keyword)) {
        tools.push(...toolList);
      }
    });

    return {
      type: 'rule',
      originalTask: task,
      steps: [task],
      tools: [...new Set(tools)],
    };
  }

  async executeSteps(taskAnalysis, context) {
    const results = [];

    for (const step of taskAnalysis.steps) {
      const tool = this.selectBestTool(step, taskAnalysis.tools);
      if (!tool) {
        results.push({ success: false, error: '没有合适的工具' });
        continue;
      }

      const params = this.parseToolParams(step, tool, context);
      const toolDef = this.registry.get(tool);
      const result = await toolDef.execute(params);

      results.push({
        tool,
        step,
        params,
        result,
        success: result.success,
      });
    }

    return results;
  }

  selectBestTool(step, preferredTools) {
    const availableTools = this.registry.getAll();
    
    for (const tool of preferredTools) {
      if (availableTools.find(t => t.name === tool)) {
        return tool;
      }
    }

    const stepLower = step.toLowerCase();
    
    if (stepLower.includes('创建') || stepLower.includes('写入')) return 'write';
    if (stepLower.includes('读取')) return 'read';
    if (stepLower.includes('存储') || stepLower.includes('保存')) return 'storage';
    if (stepLower.includes('请求') || stepLower.includes('http')) return 'fetch';

    return null;
  }

  parseToolParams(step, tool, context) {
    const params = {};

    switch (tool) {
      case 'read':
        params.path = context.filePath || 'file.txt';
        break;
      case 'write':
        params.path = context.filePath || 'output.txt';
        params.content = context.content || step.replace(/创建|写入/g, '').trim();
        break;
      case 'storage':
        params.operation = context.operation || 'set';
        params.key = context.key || 'default';
        params.value = context.value || step;
        break;
      case 'fetch':
        params.url = context.url || 'https://httpbin.org/get';
        params.method = context.method || 'GET';
        break;
    }

    return params;
  }

  async summarizeResults(results, taskAnalysis) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    let summary = `任务执行完成。`;

    if (successful.length > 0) {
      summary += `成功执行 ${successful.length} 个步骤。`;
    }

    if (failed.length > 0) {
      summary += `${failed.length} 个步骤失败。`;
    }

    return summary;
  }

  getStatus() {
    return {
      memory: this.memory.getStatus(),
      activeTasks: this.activeTasks.size,
      tools: this.registry.getAll().length,
      environment: 'browser',
    };
  }
}

// 浏览器内存管理
class BrowserMemory {
  constructor() {
    this.tasks = [];
    this.maxTasks = 100;
  }

  addTask(task) {
    this.tasks.push(task);
    if (this.tasks.length > this.maxTasks) {
      this.tasks = this.tasks.slice(-this.maxTasks);
    }
  }

  getTaskTimestamp(taskId) {
    const task = this.tasks.find(t => t.taskId === taskId);
    return task ? task.timestamp : Date.now();
  }

  getStatus() {
    return {
      tasks: this.tasks.length,
    };
  }
}

// 浏览器工具注册器
class BrowserToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(name, tool) {
    this.tools.set(name, tool);
  }

  get(name) {
    return this.tools.get(name);
  }

  getAll() {
    return Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      description: tool.description,
    }));
  }
}

module.exports = BrowserWkAgent;