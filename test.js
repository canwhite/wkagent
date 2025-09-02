/**
 * 快速测试脚本
 * 验证Work AgentJS系统的基础功能
 */

const WkAgent = require("./work-agent");

async function runTests() {
  console.log("🧪 开始测试Work AgentJS系统...\n");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 3,
  });

  const tests = [];

  // 测试1：Agent初始化
  tests.push({
    name: "Agent初始化",
    test: () => {
      const status = agent.getStatus();
      return status.tools > 0 && typeof status === "object";
    },
  });

  // 测试2：工具注册
  tests.push({
    name: "工具注册",
    test: () => {
      const tools = agent.getAvailableTools();
      return tools.length >= 5; // 至少有5个基础工具
    },
  });

  // 测试3：内存系统
  tests.push({
    name: "内存系统",
    test: () => {
      agent.memory.addToShortTerm({ type: "test", content: "test" });
      return agent.memory.shortTerm.length > 0;
    },
  });

  // 测试4：文件工具
  tests.push({
    name: "文件写入",
    test: async () => {
      try {
        const result = await agent.execute({
          task: "创建测试文件test.txt，内容为'测试内容'",
          context: { outputPath: "./test.txt" },
        });
        return result.success !== false;
      } catch (error) {
        console.error("文件写入测试失败:", error.message);
        return false;
      }
    },
  });

  // 测试5：文件读取
  tests.push({
    name: "文件读取",
    test: async () => {
      try {
        const result = await agent.execute({
          task: "读取test.txt文件内容",
          context: { projectPath: "." },
        });
        return result.results[0]?.result?.content?.includes("测试内容");
      } catch (error) {
        console.error("文件读取测试失败:", error.message);
        return false;
      }
    },
  });

  // 测试6：搜索功能
  tests.push({
    name: "文件搜索",
    test: async () => {
      try {
        const result = await agent.execute({
          task: "查找所有.js文件",
          context: { projectPath: "." },
        });
        return result.results[0]?.result?.files?.length > 0;
      } catch (error) {
        console.error("文件搜索测试失败:", error.message);
        return false;
      }
    },
  });

  // 测试7：参数验证
  tests.push({
    name: "参数验证",
    test: () => {
      const validation = agent.registry.validateParams("read", {
        path: "test.txt",
      });
      return validation.valid;
    },
  });

  // 测试8：错误处理
  tests.push({
    name: "错误处理",
    test: async () => {
      try {
        const result = await agent.execute({
          task: "读取不存在的文件",
          context: { projectPath: "./nonexistent.txt" },
        });
        return result.results[0]?.success === false;
      } catch (error) {
        return true; // 期望失败
      }
    },
  });

  // 运行所有测试
  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    try {
      const result = await Promise.resolve(test.test());
      if (result) {
        console.log(`✅ ${test.name}: 通过`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: 失败`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: 错误 - ${error.message}`);
    }
  }

  console.log(`\n📊 测试结果: ${passed}/${total} 测试通过`);

  // 清理测试文件
  try {
    const fs = require("fs");
    if (fs.existsSync("./test.txt")) {
      fs.unlinkSync("./test.txt");
    }
  } catch (error) {
    // 忽略清理错误
  }

  // 最终状态
  const finalStatus = agent.getStatus();
  console.log("\n📈 最终状态:", finalStatus);

  return passed === total;
}

// 如果直接运行
if (require.main === module) {
  runTests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runTests };
