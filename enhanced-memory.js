/**
 * Enhanced Memory System based on Claude Workflow
 * Implements 3-tier memory architecture with LLM message management
 * Based on claude_workflow.md Chapter 3.1
 */

class EnhancedAgentMemory {
  constructor() {
    // 三层记忆架构
    this.shortTerm = [];      // 短期记忆：当前会话 + LLM消息
    this.mediumTerm = [];     // 中期记忆：8段式结构化压缩
    this.longTerm = {};       // 长期记忆：项目配置和持久数据
    
    // LLM消息管理
    this.llmMessages = [];    // 完整的LLM对话历史
    this.messagesByRole = {   // 按角色分类的消息
      user: [],
      assistant: [],
      system: [],
      tool: []
    };
    
    // 上下文统计
    this.contextStats = {
      totalTokens: 0,
      userMessages: 0,
      assistantMessages: 0,
      toolCalls: 0,
      compressionCount: 0,
      sessionStart: Date.now(),
      lastCompressTime: Date.now()
    };
    
    // 压缩配置（基于92%阈值）
    this.compressionConfig = {
      tokenThreshold: 4000 * 0.92,  // 92% of 4k context
      messageThreshold: 100,
      compressionRatio: 0.8,
      maxContextSize: 4000
    };
  }

  /**
   * 添加消息到记忆系统（支持LLM消息格式）
   */
  addMessage(message) {
    const enrichedMessage = {
      ...message,
      id: this.generateId(),
      timestamp: Date.now(),
      tokenCount: this.estimateTokens(message.content || ''),
      role: message.role || 'system',
      type: message.type || 'general',
      metadata: {
        tool: message.tool,
        functionCall: message.function_call,
        finishReason: message.finish_reason
      }
    };

    // 添加到短期记忆
    this.shortTerm.push(enrichedMessage);
    
    // 添加到LLM消息管理
    if (['user', 'assistant', 'system', 'tool'].includes(enrichedMessage.role)) {
      this.llmMessages.push(enrichedMessage);
      this.messagesByRole[enrichedMessage.role].push(enrichedMessage);
    }

    // 更新统计信息
    this.updateContextStats(enrichedMessage);

    // 智能压缩检查
    if (this.shouldCompress()) {
      this.compressMemory();
    }
  }

  /**
   * 生成唯一标识符
   */
  generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 估算token数量（基于Claude的估算算法）
   */
  estimateTokens(text) {
    if (!text) return 0;
    // 平均每个token约0.75个单词
    return Math.ceil(text.split(/\s+/).length * 1.33);
  }

  /**
   * 更新上下文统计
   */
  updateContextStats(message) {
    this.contextStats.totalTokens += message.tokenCount || 0;
    
    switch (message.role) {
      case 'user':
        this.contextStats.userMessages++;
        break;
      case 'assistant':
        this.contextStats.assistantMessages++;
        break;
      case 'tool':
        this.contextStats.toolCalls++;
        break;
    }
  }

  /**
   * 智能压缩判断（92%阈值触发）
   */
  shouldCompress() {
    return this.contextStats.totalTokens > this.compressionConfig.tokenThreshold ||
           this.shortTerm.length > this.compressionConfig.messageThreshold;
  }

  /**
   * 8段式结构化压缩（基于AU2算法）
   */
  compressMemory() {
    const compressed = this.generateStructuredSummary();
    
    this.mediumTerm.push({
      type: "structured_compression",
      summary: compressed,
      timestamp: Date.now(),
      originalCount: this.shortTerm.length,
      originalTokens: this.contextStats.totalTokens,
      compressionRatio: compressed.metadata.compressionRatio
    });

    // 保留最近20条消息用于上下文
    this.shortTerm = this.shortTerm.slice(-20);
    
    // 清理旧数据
    this.cleanupOldMessages();

    // 更新统计
    this.contextStats.compressionCount++;
    this.contextStats.lastCompressTime = Date.now();
    this.contextStats.totalTokens = this.shortTerm.reduce((sum, msg) => 
      sum + (msg.tokenCount || 0), 0);
  }

  /**
   * 生成8段式结构化摘要
   */
  generateStructuredSummary() {
    const messages = this.shortTerm;
    const originalTokens = this.contextStats.totalTokens;
    
    return {
      backgroundContext: this.extractBackgroundContext(messages),
      keyDecisions: this.extractKeyDecisions(),
      toolUsage: this.extractToolUsage(),
      userIntent: this.extractUserIntent(),
      executionResults: this.extractExecutionResults(),
      errorHandling: this.extractErrorHandling(),
      openIssues: this.extractOpenIssues(),
      futurePlans: this.extractFuturePlans(),
      metadata: {
        originalCount: messages.length,
        savedTokens: originalTokens,
        compressionTime: Date.now(),
        keyTopics: this.extractKeyTopics(),
        dominantRole: this.getDominantRole(),
        compressionRatio: 0.8, // 估算压缩率
        sessionDuration: Date.now() - this.contextStats.sessionStart
      }
    };
  }

  /**
   * 提取背景上下文
   */
  extractBackgroundContext(messages) {
    const recentMessages = messages.slice(-10);
    return {
      projectPath: this.longTerm.projectPath,
      currentTask: this.longTerm.currentTask,
      sessionContext: recentMessages.map(m => ({
        role: m.role,
        type: m.type,
        preview: (m.content || '').substring(0, 80),
        timestamp: m.timestamp
      }))
    };
  }

  /**
   * 提取关键决策
   */
  extractKeyDecisions() {
    return this.shortTerm
      .filter(m => m.type === 'decision' || m.content?.includes('决定') || m.content?.includes('选择'))
      .map(m => ({
        content: m.content,
        context: m.context,
        timestamp: m.timestamp,
        reasoning: m.metadata?.reasoning
      }));
  }

  /**
   * 提取工具使用模式
   */
  extractToolUsage() {
    const toolMessages = this.shortTerm.filter(m => m.type === 'tool_result' || m.tool);
    const toolMap = {};
    
    toolMessages.forEach(m => {
      const tool = m.tool || m.type;
      if (!toolMap[tool]) toolMap[tool] = { count: 0, success: 0 };
      toolMap[tool].count++;
      if (m.success !== false) toolMap[tool].success++;
    });

    return {
      toolsUsed: Object.keys(toolMap),
      usageFrequency: Object.entries(toolMap)
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 5),
      successRate: Object.entries(toolMap).reduce((acc, [tool, data]) => {
        acc[tool] = { total: data.count, success: data.success, rate: data.success / data.count };
        return acc;
      }, {})
    };
  }

  /**
   * 提取用户意图
   */
  extractUserIntent() {
    const userMessages = this.messagesByRole.user.slice(-5);
    return {
      primaryIntent: userMessages.slice(-1)[0]?.content || '未指定',
      intentHistory: userMessages.map(m => ({
        content: m.content,
        timestamp: m.timestamp,
        tokenCount: m.tokenCount
      })),
      complexity: this.getIntentComplexity(),
      keywords: this.extractKeywords(userMessages)
    };
  }

  /**
   * 提取执行结果
   */
  extractExecutionResults() {
    return this.shortTerm
      .filter(m => m.type === 'task_result' || m.type === 'tool_result')
      .map(m => ({
        type: m.type,
        success: m.success,
        tool: m.tool,
        summary: m.summary || m.content?.substring(0, 150),
        timestamp: m.timestamp,
        duration: m.duration
      }));
  }

  /**
   * 提取错误处理
   */
  extractErrorHandling() {
    return this.shortTerm
      .filter(m => m.type === 'error' || (m.result && !m.result.success))
      .map(m => ({
        error: m.error || m.result?.error,
        context: m.step || m.content?.substring(0, 100),
        recoveryAction: m.recoveryAction,
        timestamp: m.timestamp,
        severity: this.getErrorSeverity(m.error)
      }));
  }

  /**
   * 提取未解决问题
   */
  extractOpenIssues() {
    const errors = this.extractErrorHandling();
    const incomplete = this.shortTerm.filter(m => 
      m.type === 'task_start' && !m.completed && 
      Date.now() - m.timestamp > 300000 // 5分钟未完成
    );
    
    return {
      errors: errors.slice(-3),
      incompleteTasks: incomplete.length,
      pendingItems: this.longTerm.pendingItems || []
    };
  }

  /**
   * 提取未来计划
   */
  extractFuturePlans() {
    const plans = this.shortTerm.filter(m => 
      m.type === 'plan' || m.content?.includes('下一步') || m.content?.includes('计划')
    );
    return plans.map(m => ({
      content: m.content?.substring(0, 150),
      priority: m.priority || 'normal',
      estimatedTime: m.estimatedTime,
      dependencies: m.dependencies || []
    }));
  }

  /**
   * 提取关键主题
   */
  extractKeyTopics() {
    const topicMap = new Map();
    
    this.shortTerm.forEach(m => {
      if (m.content) {
        const words = m.content.toLowerCase().match(/\b\w{4,}\b/g) || [];
        const techTerms = ['node', 'javascript', 'python', 'api', 'server', 'client', 'database', 'tool'];
        
        words.forEach(word => {
          if (techTerms.includes(word) || word.length > 5) {
            topicMap.set(word, (topicMap.get(word) || 0) + 1);
          }
        });
      }
    });

    return Array.from(topicMap.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([topic, count]) => ({ topic, count }));
  }

  /**
   * 获取主导角色
   */
  getDominantRole() {
    const roles = {};
    this.shortTerm.forEach(m => {
      roles[m.role] = (roles[m.role] || 0) + 1;
    });
    
    const sorted = Object.entries(roles).sort(([,a], [,b]) => b - a);
    return sorted[0]?.[0] || 'system';
  }

  /**
   * 获取意图复杂度
   */
  getIntentComplexity() {
    const userMessages = this.messagesByRole.user;
    if (userMessages.length === 0) return 'simple';
    
    const avgLength = userMessages.reduce((sum, m) => 
      sum + (m.content?.length || 0), 0) / userMessages.length;
    
    if (avgLength < 50) return 'simple';
    if (avgLength < 200) return 'moderate';
    if (avgLength < 500) return 'complex';
    return 'very_complex';
  }

  /**
   * 提取关键词
   */
  extractKeywords(messages) {
    const keywords = new Set();
    const techTerms = ['function', 'class', 'method', 'variable', 'file', 'command', 'api', 'server'];
    
    messages.forEach(m => {
      if (m.content) {
        techTerms.forEach(term => {
          if (m.content.toLowerCase().includes(term)) {
            keywords.add(term);
          }
        });
      }
    });
    
    return Array.from(keywords);
  }

  /**
   * 获取错误严重程度
   */
  getErrorSeverity(error) {
    if (!error) return 'info';
    const errorStr = error.toString().toLowerCase();
    
    if (errorStr.includes('fatal') || errorStr.includes('crash')) return 'critical';
    if (errorStr.includes('error') || errorStr.includes('failed')) return 'error';
    if (errorStr.includes('warning')) return 'warning';
    return 'info';
  }

  /**
   * 获取LLM对话上下文
   */
  getLLMContext(maxTokens = 4000) {
    const messages = [];
    let currentTokens = 0;

    // 从最新消息开始倒序添加
    for (let i = this.llmMessages.length - 1; i >= 0; i--) {
      const msg = this.llmMessages[i];
      const msgTokens = msg.tokenCount || 0;
      
      if (currentTokens + msgTokens > maxTokens) break;
      
      messages.unshift({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      });
      currentTokens += msgTokens;
    }

    return {
      messages,
      totalTokens: currentTokens,
      messageCount: messages.length,
      compressionRatio: currentTokens / this.contextStats.totalTokens || 0
    };
  }

  /**
   * 清理旧消息
   */
  cleanupOldMessages() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24小时
    
    Object.keys(this.messagesByRole).forEach(role => {
      this.messagesByRole[role] = this.messagesByRole[role].filter(
        m => m.timestamp > cutoff
      );
    });
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      memory: {
        shortTerm: this.shortTerm.length,
        mediumTerm: this.mediumTerm.length,
        longTerm: Object.keys(this.longTerm).length
      },
      messages: {
        total: this.llmMessages.length,
        user: this.messagesByRole.user.length,
        assistant: this.messagesByRole.assistant.length,
        system: this.messagesByRole.system.length,
        tool: this.messagesByRole.tool.length
      },
      context: this.contextStats,
      compression: {
        count: this.contextStats.compressionCount,
        lastTime: this.contextStats.lastCompressTime,
        threshold: this.compressionConfig.tokenThreshold
      }
    };
  }

  /**
   * 导出会话数据
   */
  exportSession() {
    return {
      shortTerm: this.shortTerm,
      mediumTerm: this.mediumTerm,
      longTerm: this.longTerm,
      llmMessages: this.llmMessages,
      messagesByRole: this.messagesByRole,
      contextStats: this.contextStats,
      exportTime: Date.now()
    };
  }

  /**
   * 导入会话数据
   */
  importSession(data) {
    this.shortTerm = data.shortTerm || [];
    this.mediumTerm = data.mediumTerm || [];
    this.longTerm = data.longTerm || {};
    this.llmMessages = data.llmMessages || [];
    this.messagesByRole = data.messagesByRole || {
      user: [], assistant: [], system: [], tool: []
    };
    this.contextStats = { ...this.contextStats, ...data.contextStats };
  }

  /**
   * 重置内存
   */
  reset() {
    this.shortTerm = [];
    this.mediumTerm = [];
    this.longTerm = {};
    this.llmMessages = [];
    this.messagesByRole = { user: [], assistant: [], system: [], tool: [] };
    this.contextStats = {
      totalTokens: 0,
      userMessages: 0,
      assistantMessages: 0,
      toolCalls: 0,
      compressionCount: 0,
      sessionStart: Date.now(),
      lastCompressTime: Date.now()
    };
  }
}

module.exports = { EnhancedAgentMemory };