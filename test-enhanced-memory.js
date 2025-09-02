#!/usr/bin/env node

const { EnhancedAgentMemory } = require('./enhanced-memory');

async function testEnhancedMemory() {
  console.log('🧪 测试增强型记忆系统...\n');

  const memory = new EnhancedAgentMemory();

  try {
    // 测试1: 添加不同类型的消息
    console.log('📋 测试1: 添加各种消息类型');
    
    memory.addMessage({
      role: 'system',
      content: '你是一个智能编程助手，帮助用户完成开发任务。',
      type: 'system_prompt'
    });

    memory.addMessage({
      role: 'user',
      content: '请帮我创建一个Node.js HTTP服务器，监听3000端口',
      type: 'task_request'
    });

    memory.addMessage({
      role: 'assistant',
      content: '我将为您创建一个简单的Node.js HTTP服务器。',
      type: 'task_analysis'
    });

    memory.addMessage({
      role: 'tool',
      content: '使用write工具创建server.js文件',
      tool: 'write',
      success: true,
      type: 'tool_result'
    });

    console.log('✅ 消息添加完成');
    console.log('📊 当前状态:', memory.getStatus());

    // 测试2: LLM上下文获取
    console.log('\n📋 测试2: LLM上下文管理');
    const llmContext = memory.getLLMContext(1000);
    console.log(`✅ LLM上下文: ${llmContext.messageCount}条消息, ${llmContext.totalTokens}tokens`);

    // 测试3: 模拟大量消息触发压缩
    console.log('\n📋 测试3: 触发智能压缩');
    
    for (let i = 0; i < 50; i++) {
      memory.addMessage({
        role: 'user',
        content: `这是第${i+1}条测试消息，用于测试内存压缩功能。`,
        type: 'test_message'
      });
    }

    console.log('✅ 压缩触发完成');
    console.log('📊 压缩后状态:', memory.getStatus());

    // 测试4: 检查压缩后的摘要
    if (memory.mediumTerm.length > 0) {
      console.log('\n📋 测试4: 检查压缩摘要');
      const summary = memory.mediumTerm[0].summary;
      console.log('📊 压缩摘要包含:', Object.keys(summary));
      console.log('🎯 关键主题:', summary.metadata.keyTopics.slice(0, 3));
    }

    // 测试5: 导出/导入会话
    console.log('\n📋 测试5: 会话导出/导入');
    const exported = memory.exportSession();
    const newMemory = new EnhancedAgentMemory();
    newMemory.importSession(exported);
    
    console.log('✅ 会话导出/导入完成');
    console.log('📊 导入后状态:', newMemory.getStatus());

    // 测试6: 工具使用分析
    console.log('\n📋 测试6: 工具使用分析');
    const toolUsage = memory.extractToolUsage();
    console.log('🛠️ 使用的工具:', toolUsage.toolsUsed);
    console.log('📈 使用频率:', toolUsage.usageFrequency);

    console.log('\n✅ 所有测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  testEnhancedMemory();
}

module.exports = { testEnhancedMemory };