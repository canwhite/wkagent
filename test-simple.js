#!/usr/bin/env node

const WkAgent = require("./work-agent");

async function simpleTest() {
  console.log("🧪 简单测试 WkAgent + DeepSeek...\n");

  const agent = new WkAgent({
    enableLearning: true,
    llm: {
      enableLLM: true,
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: "deepseek-chat",
      baseURL: "https://api.deepseek.com",
    },
  });

  try {
    // 测试LLM理解能力
    const result = await agent.analyzeTask({
      task: "创建一个简单的Node.js HTTP服务器",
      context: { type: "nodejs" },
    });

    console.log("✅ LLM分析结果:", JSON.stringify(result, null, 2));

    // 测试健康检查
    if (agent.llmService) {
      const healthy = await agent.llmService.healthCheck();
      console.log("✅ LLM健康状态:", healthy ? "正常" : "异常");
    }

    // 测试执行能力 - 文件操作
    console.log("\n🧪 测试文件操作执行能力...");
    const fileOpResult = await agent.execute({
      task: "创建一个包含当前时间戳的test.txt文件",
      context: {
        projectPath: process.cwd(),
        filePath: "./test.txt",
        content: `当前时间戳: ${new Date().toISOString()}`,
      },
    });
    console.log("✅ 文件操作结果:", JSON.stringify(fileOpResult, null, 2));

    // 测试执行能力 - 系统命令
    console.log("\n🧪 测试系统命令执行能力...");
    const cmdResult = await agent.execute({
      task: "执行ls -la命令并返回结果",
      context: {
        projectPath: process.cwd(),
        command: "ls -la",
      },
    });
    console.log("✅ 系统命令结果:", JSON.stringify(cmdResult, null, 2));

    // 测试执行能力 - 代码执行
    console.log("\n🧪 测试代码执行能力...");
    const codeResult = await agent.execute({
      task: "创建一个JavaScript文件来计算1到100的和",
      context: {
        projectPath: process.cwd(),
        outputFile: "./sum-calculator.js",
        code: `const sum = Array.from({length: 100}, (_, i) => i + 1).reduce((a, b) => a + b, 0);
console.log('1到100的和:', sum);
require('fs').writeFileSync('sum-result.txt', sum.toString());`,
      },
    });
    console.log("✅ 代码执行结果:", JSON.stringify(codeResult, null, 2));

    // 测试复杂任务执行 - Web服务器
    console.log("\n🧪 测试复杂任务执行能力...");
    const complexResult = await agent.execute({
      task: "创建一个简单的Node.js HTTP服务器，监听3000端口，返回Hello World",
      context: {
        projectPath: process.cwd(),
        serverFile: "./simple-server.js",
        port: 3000,
      },
    });
    console.log("✅ 复杂任务结果:", JSON.stringify(complexResult, null, 2));

    // 测试错误处理
    console.log("\n🧪 测试错误处理能力...");
    try {
      const errorResult = await agent.execute({
        task: "执行一个明显会失败的命令：invalid_command_xyz",
        context: { type: "error_test" },
      });
      console.log("⚠️  错误测试结果:", JSON.stringify(errorResult, null, 2));
    } catch (error) {
      console.log("✅ 错误处理正常:", error.message);
    }
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
  }
}

// 仅在直接运行时执行测试
if (require.main === module) {
  simpleTest();
}

module.exports = { simpleTest };
