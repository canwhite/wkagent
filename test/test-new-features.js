#!/usr/bin/env node

const WkAgent = require("../work-agent");

async function testNewFeatures() {
  console.log("🧪 测试新功能...\n");

  const agent = new WkAgent({
    enableLearning: true,
    llm: {
      enableLLM: true,
      apiKey: process.env.DEEPSEEK_API_KEY,
    },
  });

  try {
    // 测试1: 统一接口 - addMessage
    console.log("📋 测试统一接口...");
    agent.memory.addMessage({
      role: "system",
      content: "测试统一接口",
      type: "system_prompt"
    });
    console.log("✅ addMessage接口工作正常");

    // 测试2: 会话持久化
    console.log("\n💾 测试会话持久化...");
    
    // 添加一些测试数据
    agent.memory.addMessage({
      role: "user",
      content: "测试会话保存",
      type: "test_message"
    });

    const saveResult = await agent.saveSession("test-session.json");
    if (saveResult.success) {
      console.log("✅ 会话保存成功:", saveResult.filepath);
      
      const loadResult = await agent.loadSession("test-session.json");
      if (loadResult.success) {
        console.log("✅ 会话加载成功", loadResult.restored);
      }
    }

    // 测试3: 批量执行
    console.log("\n⚡ 测试批量执行...");
    const batchTasks = [
      "创建一个hello.txt文件",
      "创建一个world.txt文件", 
      "创建一个test.js文件"
    ];

    const batchResult = await agent.batchExecute(batchTasks, {
      maxConcurrency: 2,
      context: { projectPath: process.cwd() }
    });
    
    console.log("✅ 批量执行完成:", {
      total: batchResult.total,
      successful: batchResult.successful,
      failed: batchResult.failed
    });

    console.log("\n🎉 所有新功能测试完成！");

  } catch (error) {
    console.error("❌ 测试失败:", error.message);
  }
}

if (require.main === module) {
  testNewFeatures();
}

module.exports = { testNewFeatures };