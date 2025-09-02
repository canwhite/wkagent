#!/usr/bin/env node

const WkAgent = require("./work-agent");

async function testExecutionCapabilities() {
  console.log("🧪 执行能力专项测试...\n");

  const agent = new WkAgent({
    enableLearning: true,
    llm: {
      enableLLM: true,
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: "deepseek-chat",
      baseURL: "https://api.deepseek.com",
    },
  });

  // 测试1：文件写入
  console.log("📝 测试1：文件写入能力");
  try {
    const writeResult = await agent.execute({
      task: "创建一个test-output.txt文件，内容为当前时间戳",
      context: {
        projectPath: process.cwd(),
        outputPath: "./test-output.txt",
      },
    });
    console.log("✅ 文件写入成功:", writeResult.summary);
  } catch (error) {
    console.log("❌ 文件写入失败:", error.message);
  }

  // 测试2：文件读取
  console.log("\n📖 测试2：文件读取能力");
  try {
    const readResult = await agent.execute({
      task: "读取刚才创建的test-output.txt文件内容",
      context: {
        projectPath: process.cwd(),
        targetFile: "./test-output.txt",
      },
    });
    console.log("✅ 文件读取成功:", readResult.summary);
  } catch (error) {
    console.log("❌ 文件读取失败:", error.message);
  }

  // 测试3：系统命令
  console.log("\n⚙️  测试3：系统命令执行能力");
  try {
    const cmdResult = await agent.execute({
      task: "执行ls -la命令，显示当前目录文件列表",
      context: {
        projectPath: process.cwd(),
        command: "ls -la",
      },
    });
    console.log("✅ 系统命令执行成功:", cmdResult.summary);
  } catch (error) {
    console.log("❌ 系统命令执行失败:", error.message);
  }

  // 测试4：文件搜索
  console.log("\n🔍 测试4：文件搜索能力");
  try {
    const searchResult = await agent.execute({
      task: "查找所有.js文件",
      context: {
        projectPath: process.cwd(),
        pattern: "**/*.js",
      },
    });
    console.log("✅ 文件搜索成功:", searchResult.summary);
  } catch (error) {
    console.log("❌ 文件搜索失败:", error.message);
  }

  // 测试5：代码执行
  console.log("\n💻 测试5：代码执行能力");
  try {
    const codeResult = await agent.execute({
      task: "创建一个简单的JavaScript文件来计算1到100的和并执行",
      context: {
        projectPath: process.cwd(),
        outputFile: "./sum-calculator.js",
      },
    });
    console.log("✅ 代码执行成功:", codeResult.summary);
  } catch (error) {
    console.log("❌ 代码执行失败:", error.message);
  }

  // 测试6：Web服务器创建
  console.log("\n🌐 测试6：Web服务器创建能力");
  try {
    const serverResult = await agent.execute({
      task: "创建一个简单的Node.js HTTP服务器，监听3000端口，返回Hello World",
      context: {
        projectPath: process.cwd(),
        serverFile: "./simple-server.js",
        port: 3000,
      },
    });
    console.log("✅ Web服务器创建成功:", serverResult.summary);
  } catch (error) {
    console.log("❌ Web服务器创建失败:", error.message);
  }

  // 测试7：错误处理
  console.log("\n🚨 测试7：错误处理能力");
  try {
    const errorResult = await agent.execute({
      task: "尝试读取不存在的文件nonexistent.txt",
      context: {
        projectPath: process.cwd(),
      },
    });
    console.log("⚠️  错误处理结果:", errorResult.summary);
  } catch (error) {
    console.log("✅ 错误处理正常:", error.message);
  }

  console.log("\n🎯 执行能力测试完成！");
}

testExecutionCapabilities().catch(console.error);
