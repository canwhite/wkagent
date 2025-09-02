/**
 * SubAgent 使用示例
 * 展示基于course.md架构的I2A子Agent功能
 */

const WkAgent = require("./work-agent");
const { SubAgent, SubAgentManager } = require("./sub-agent");

/**
 * 示例1：基础SubAgent使用
 */
async function basicSubAgentExample() {
  console.log("=== 示例1：基础SubAgent使用 ===");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 5,
  });

  try {
    // 使用Task工具创建SubAgent
    const result = await agent.execute({
      task: "使用task工具创建SubAgent分析项目",
      context: {
        taskParams: {
          description: "项目分析",
          prompt: "分析当前目录下的JavaScript文件，统计代码行数并生成报告",
        },
      },
    });

    console.log("SubAgent结果:", result.results[0].result);
  } catch (error) {
    console.error("基础SubAgent失败:", error.message);
  }
}

/**
 * 示例2：直接创建SubAgent
 */
async function directSubAgentExample() {
  console.log("\n=== 示例2：直接创建SubAgent ===");

  const subAgent = new SubAgent(
    {},
    {
      task: "分析当前目录结构",
      description: "目录扫描",
      parentId: "main_agent_1",
    }
  );

  // 监听SubAgent事件
  subAgent.on("start", (data) => {
    console.log(`SubAgent ${data.subAgentId} 开始任务: ${data.task}`);
  });

  subAgent.on("complete", (result) => {
    console.log(`SubAgent ${result.subAgentId} 完成: ${result.summary}`);
    console.log(`执行时间: ${result.duration}ms`);
  });

  try {
    const result = await subAgent.execute("扫描并分析当前目录下的所有文件");
    console.log("详细结果:", result);
  } catch (error) {
    console.error("SubAgent执行失败:", error.message);
  }
}

/**
 * 示例3：并发SubAgent任务
 */
async function concurrentSubAgentExample() {
  console.log("\n=== 示例3：并发SubAgent任务 ===");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 10,
  });

  // 监听SubAgent事件
  agent.on("subAgent:start", (data) => {
    console.log(`🚀 SubAgent启动: ${data.subAgentId}`);
  });

  agent.on("subAgent:complete", (result) => {
    console.log(`✅ SubAgent完成: ${result.subAgentId} - ${result.summary}`);
  });

  try {
    const tasks = [
      { task: "分析agent-core.js文件", description: "文件分析" },
      { task: "统计当前目录下JS文件数量", description: "文件统计" },
      { task: "搜索包含'class'的代码行", description: "代码搜索" },
    ];

    const results = await agent.executeSubTasksConcurrently(tasks);

    console.log("\n📊 并发结果:");
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        console.log(`任务${index + 1}: ✅ ${result.value.summary}`);
      } else {
        console.log(`任务${index + 1}: ❌ ${result.reason}`);
      }
    });

    // 查看SubAgent状态
    const status = agent.getSubAgentStatus();
    console.log("\n📈 SubAgent状态:", status);
  } catch (error) {
    console.error("并发SubAgent失败:", error.message);
  }
}

/**
 * 示例4：使用SubAgentManager直接管理
 */
async function managerExample() {
  console.log("\n=== 示例4：SubAgentManager使用 ===");

  const manager = new SubAgentManager({
    maxConcurrency: 5,
    maxSubAgents: 3,
  });

  manager.on("subAgent:start", (data) => {
    console.log(`📋 创建SubAgent: ${data.subAgentId}`);
  });

  manager.on("subAgent:complete", (result) => {
    console.log(`🏁 SubAgent完成: ${result.summary}`);
  });

  try {
    const tasks = [
      { description: "文件扫描", task: "扫描所有.js文件" },
      { description: "内容分析", task: "分析README.md内容" },
      { description: "依赖检查", task: "检查package.json依赖" },
    ];

    const results = await manager.executeConcurrent(tasks);

    console.log("\n📊 管理器结果:");
    results.forEach((result, index) => {
      console.log(
        `任务${index + 1}:`,
        result.status === "fulfilled" ? result.value : result.reason
      );
    });
  } catch (error) {
    console.error("管理器失败:", error.message);
  }
}

/**
 * 示例5：复杂任务分解
 */
async function complexTaskDecomposition() {
  console.log("\n=== 示例5：复杂任务分解 ===");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 5,
  });

  try {
    // 创建一个复杂任务，自动分解为多个SubAgent
    const result = await agent.execute({
      task: "重构项目代码结构",
      context: {
        taskParams: {
          description: "代码重构",
          prompt:
            "分步骤完成：1.扫描所有JS文件 2.识别重复代码 3.创建工具函数 4.批量重构引用",
        },
      },
    });

    console.log("复杂任务结果:", result);
  } catch (error) {
    console.error("复杂任务失败:", error.message);
  }
}

/**
 * 示例6：LLM增强的SubAgent
 */
async function llmEnhancedSubAgent() {
  console.log("\n=== 示例6：LLM增强SubAgent ===");

  if (!process.env.CLAUDE_API_KEY) {
    console.log("跳过LLM增强示例，请设置CLAUDE_API_KEY");
    return;
  }

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 5,
    llm: {
      enableLLM: true,
      apiKey: process.env.CLAUDE_API_KEY,
      maxTokens: 2000,
    },
  });

  try {
    const result = await agent.execute({
      task: "使用LLM增强分析TypeScript项目",
      context: {
        taskParams: {
          description: "智能分析",
          prompt: "使用LLM理解项目结构，分析最佳实践，并生成改进建议",
        },
      },
    });

    console.log("LLM增强结果:", result);
  } catch (error) {
    console.error("LLM增强失败:", error.message);
  }
}

/**
 * 示例7：SubAgent状态监控
 */
async function monitoringExample() {
  console.log("\n=== 示例7：状态监控 ===");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 10,
  });

  // 设置全局监听器
  agent.on("subAgent:start", (data) => {
    console.log(`🔍 监控: SubAgent ${data.subAgentId} 启动`);
  });

  agent.on("subAgent:complete", (result) => {
    console.log(
      `✨ 监控: SubAgent ${result.subAgentId} 完成，耗时${result.duration}ms`
    );
  });

  try {
    // 创建多个SubAgent并监控
    const subAgents = [];

    for (let i = 1; i <= 3; i++) {
      const subAgent = agent.createSubAgent({
        task: `分析文件${i}`,
        description: `第${i}个分析任务`,
        parentId: "monitor_test",
      });

      subAgent.on("start", (data) => {
        console.log(`📊 SubAgent ${data.subAgentId} 开始执行: ${data.task}`);
      });

      subAgents.push(subAgent.execute(`分析agent-core.js中的第${i}个函数`));
    }

    const results = await Promise.allSettled(subAgents);

    console.log("\n🎯 监控结果:");
    console.log("SubAgent状态:", agent.getSubAgentStatus());
  } catch (error) {
    console.error("监控失败:", error.message);
  }
}

/**
 * 示例8：错误处理和超时
 */
async function errorHandlingExample() {
  console.log("\n=== 示例8：错误处理 ===");

  const subAgent = new SubAgent(
    {
      timeout: 5000, // 5秒超时
    },
    {
      task: "执行可能失败的任务",
      description: "错误测试",
    }
  );

  subAgent.on("error", (error) => {
    console.log("❌ SubAgent错误:", error.error);
  });

  try {
    // 模拟错误任务
    const result = await subAgent.execute("读取不存在的文件nonexistent.txt");
    console.log("错误处理结果:", result);
  } catch (error) {
    console.error("预期错误:", error.message);
  }
}

/**
 * 主运行函数
 */
async function runAllSubAgentExamples() {
  console.log("🤖 SubAgent系统示例开始\n");

  try {
    await basicSubAgentExample();
    await directSubAgentExample();
    await concurrentSubAgentExample();
    await managerExample();
    await complexTaskDecomposition();
    await llmEnhancedSubAgent();
    await monitoringExample();
    await errorHandlingExample();

    console.log("\n✅ 所有SubAgent示例运行完成！");
  } catch (error) {
    console.error("❌ SubAgent示例运行失败:", error);
  }
}

/**
 * 快速SubAgent测试
 */
async function quickSubAgentTest() {
  console.log("🧪 SubAgent快速测试...");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 3,
  });

  try {
    const result = await agent.execute({
      task: "使用task工具统计当前目录文件数量",
      context: {
        taskParams: {
          description: "文件统计",
          prompt: "统计当前目录下所有文件和文件夹的数量",
        },
      },
    });

    console.log("快速测试结果:", result.results[0]?.result?.summary || "完成");
  } catch (error) {
    console.error("快速测试失败:", error.message);
  }
}

// 导出函数
module.exports = {
  basicSubAgentExample,
  directSubAgentExample,
  concurrentSubAgentExample,
  managerExample,
  complexTaskDecomposition,
  llmEnhancedSubAgent,
  monitoringExample,
  errorHandlingExample,
  runAllSubAgentExamples,
  quickSubAgentTest,
};

// 如果直接运行
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--all")) {
    runAllSubAgentExamples();
  } else if (args.includes("--quick")) {
    quickSubAgentTest();
  } else {
    console.log("SubAgent使用示例:");
    console.log("  node sub-agent-examples.js --all    # 运行所有示例");
    console.log("  node sub-agent-examples.js --quick  # 快速测试");
  }
}
