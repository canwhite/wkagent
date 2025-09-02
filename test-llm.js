#!/usr/bin/env node

const { LLMService } = require('./agent-core.js');

async function testLLM() {
  console.log('🧪 开始测试 LLM 服务...');
  
  const llmService = new LLMService();
  
  // 测试1: 健康检查
  console.log('📡 测试健康检查...');
  const isHealthy = await llmService.healthCheck();
  console.log(`健康检查状态: ${isHealthy ? '✅ 正常' : '❌ 失败'}`);
  
  if (!isHealthy) {
    console.error('❌ API 连接失败，请检查：');
    console.error('1. DEEPSEEK_API_KEY 是否正确设置');
    console.error('2. 网络连接是否正常');
    console.error('3. API 额度是否充足');
    return;
  }
  
  // 测试2: 基本对话
  console.log('💬 测试基本对话...');
  try {
    const response = await llmService.callLLM('你好，请用一句话介绍你自己。');
    console.log('✅ 响应:', response);
  } catch (error) {
    console.error('❌ 对话测试失败:', error.message);
  }
  
  // 测试3: 任务理解
  console.log('🎯 测试任务理解...');
  try {
    const task = '创建一个 Node.js Express 服务器，监听 3000 端口，提供一个 GET /hello 路由返回 JSON 响应';
    const context = { project: 'test-project', language: 'javascript' };
    
    const taskAnalysis = await llmService.understandTask(task, context);
    console.log('✅ 任务分析结果:');
    console.log(`- 任务类型: ${taskAnalysis.type}`);
    console.log(`- 主要目标: ${taskAnalysis.goal}`);
    console.log(`- 所需工具: ${taskAnalysis.tools.join(', ')}`);
    console.log(`- 执行步骤: ${taskAnalysis.steps.length} 步`);
  } catch (error) {
    console.error('❌ 任务理解测试失败:', error.message);
  }
  
  // 测试4: 工具选择
  console.log('🔧 测试工具选择...');
  try {
    const availableTools = [
      { name: 'read', description: '读取文件' },
      { name: 'write', description: '写入文件' },
      { name: 'bash', description: '执行命令' },
      { name: 'glob', description: '文件搜索' }
    ];
    
    const task = '创建一个包含用户认证功能的 Express 服务器';
    const selectedTools = await llmService.selectTools(task, availableTools);
    console.log('✅ 选择的工具:', selectedTools);
  } catch (error) {
    console.error('❌ 工具选择测试失败:', error.message);
  }
  
  console.log('🎉 测试完成！');
}

// 运行测试
if (require.main === module) {
  testLLM().catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
  });
}

module.exports = { testLLM };