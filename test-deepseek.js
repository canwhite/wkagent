#!/usr/bin/env node

const WkAgent = require("./work-agent");

async function testDeepseekIntegration() {
  console.log("🚀 开始测试 WkAgent + DeepSeek 集成...\n");

  // 创建使用DeepSeek的WkAgent实例
  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 5,
    llm: {
      enableLLM: true,
      apiKey: process.env.DEEPSEEK_API_KEY, // 使用DeepSeek API密钥
      model: "deepseek-chat",
      baseURL: "https://api.deepseek.com",
    },
  });

  console.log("📊 当前状态:", agent.getStatus());

  try {
    // 测试1: 简单任务
    console.log("\n📋 测试1: 简单任务理解");
    const result1 = await agent.execute({
      task: "创建一个简单的Node.js HTTP服务器，监听3000端口",
      context: { projectPath: "./" },
    });
    console.log("✅ 结果:", result1.summary);

    // 测试2: 文件操作任务
    console.log("\n📋 测试2: 文件操作任务");
    const result2 = await agent.execute({
      task: "读取当前目录下的package.json文件并分析其依赖",
      context: { projectPath: "./" },
    });
    console.log("✅ 结果:", result2.summary);

    // 测试3: 复杂任务
    console.log("\n📋 测试3: 复杂任务 - 创建项目结构");
    const result3 = await agent.execute({
      task: "创建一个包含用户认证功能的Express项目结构",
      context: {
        projectPath: "./test-project",
        template: "express-auth",
      },
    });
    console.log("✅ 结果:", result3.summary);

    // 测试4: 并发任务
    console.log("\n📋 测试4: 并发子任务");
    const concurrentTasks = [
      { task: "创建README.md文件", description: "创建项目README" },
      { task: "创建.gitignore文件", description: "创建Git忽略文件" },
      { task: "创建package.json文件", description: "创建项目配置文件" },
    ];

    const concurrentResults = await agent.executeSubTasksConcurrently(
      concurrentTasks,
      { projectPath: "./test-project" }
    );

    console.log("✅ 并发任务结果:", concurrentResults.length, "个任务完成");

    console.log("\n🎉 所有测试完成！");
    console.log("📊 最终状态:", agent.getStatus());
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testDeepseekIntegration();
}
