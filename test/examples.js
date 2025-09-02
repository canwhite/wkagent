/**
 * Work Agent使用示例
 * 展示如何基于course.md架构使用JS Agent系统
 */

const WkAgent = require("../work-agent");
const path = require("path");

/**
 * 示例1：基础文件操作
 */
async function basicFileOperations() {
  console.log("=== 示例1：基础文件操作 ===");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 5,
  });

  try {
    // 创建一个新文件
    const result1 = await agent.execute({
      task: "创建一个名为hello.txt的文件，内容为'Hello, Claude Agent!'",
      context: { outputPath: "./hello.txt" },
    });
    console.log("创建文件结果:", result1.summary);

    // 读取文件内容
    const result2 = await agent.execute({
      task: "读取hello.txt文件的内容",
      context: { projectPath: "." },
    });
    console.log("读取文件结果:", result2.results[0].result);

    // 编辑文件内容
    const result3 = await agent.execute({
      task: "将hello.txt中的'Hello'替换为'Hi'",
      context: { projectPath: "." },
    });
    console.log("编辑文件结果:", result3.summary);
  } catch (error) {
    console.error("基础文件操作失败:", error.message);
  }
}

/**
 * 示例2：搜索和分析项目
 */
async function projectAnalysis() {
  console.log("\n=== 示例2：项目分析 ===");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 10,
  });

  try {
    // 搜索所有JS文件
    const result1 = await agent.execute({
      task: "查找当前目录下所有的JavaScript文件",
      context: { projectPath: "." },
    });
    console.log("查找JS文件结果:", result1.results[0].result);

    // 搜索包含特定内容的文件
    const result2 = await agent.execute({
      task: "搜索包含'class'关键字的JavaScript文件",
      context: { projectPath: "." },
    });
    console.log("搜索结果:", result2.results[0].result);
  } catch (error) {
    console.error("项目分析失败:", error.message);
  }
}

/**
 * 示例3：LLM增强功能（需要API密钥）
 */
async function llmEnhancedExample() {
  console.log("\n=== 示例3：LLM增强功能 ===");

  // 检查是否设置了API密钥
  if (!process.env.CLAUDE_API_KEY) {
    console.log("跳过LLM增强示例，请设置CLAUDE_API_KEY环境变量");
    return;
  }

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 10,
    llm: {
      enableLLM: true,
      apiKey: process.env.CLAUDE_API_KEY,
    },
  });

  try {
    // LLM理解复杂任务
    const result = await agent.execute({
      task: "分析当前项目的代码结构，创建一个README.md文件总结项目特点",
      context: {
        projectPath: ".",
        outputPath: "./README_ANALYSIS.md",
      },
    });

    console.log("LLM分析结果:", result.summary);
    console.log("使用的工具:", result.metadata.toolsUsed);
  } catch (error) {
    console.error("LLM增强功能失败:", error.message);
  }
}

/**
 * 示例4：并发任务执行
 */
async function concurrentTasks() {
  console.log("\n=== 示例4：并发任务执行 ===");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 5,
  });

  try {
    // 创建多个测试文件
    const tasks = [
      {
        task: "创建文件test1.txt，内容为'测试文件1'",
        context: { outputPath: "./test1.txt" },
      },
      {
        task: "创建文件test2.txt，内容为'测试文件2'",
        context: { outputPath: "./test2.txt" },
      },
      {
        task: "创建文件test3.txt，内容为'测试文件3'",
        context: { outputPath: "./test3.txt" },
      },
    ];

    const results = await Promise.all(tasks.map((task) => agent.execute(task)));

    console.log("并发任务完成：");
    results.forEach((result, index) => {
      console.log(`任务${index + 1}: ${result.summary}`);
    });
  } catch (error) {
    console.error("并发任务失败:", error.message);
  }
}

/**
 * 示例5：自定义工具注册
 */
async function customToolExample() {
  console.log("\n=== 示例5：自定义工具 ===");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 5,
  });

  // 注册自定义工具
  agent.addTool("countLines", {
    name: "countLines",
    description: "统计文件行数",
    execute: async (params) => {
      const fs = require("fs").promises;
      try {
        const content = await fs.readFile(params.path, "utf-8");
        const lines = content.split("\n").length;
        return {
          success: true,
          lineCount: lines,
          type: "line_count",
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    schema: {
      path: { type: "string", required: true, description: "文件路径" },
    },
  });

  try {
    const result = await agent.execute({
      task: "使用自定义工具统计agent-core.js文件的行数",
      context: { projectPath: "." },
    });

    console.log("自定义工具结果:", result.results[0].result);
  } catch (error) {
    console.error("自定义工具失败:", error.message);
  }
}

/**
 * 示例6：状态监控和调试
 */
async function debuggingExample() {
  console.log("\n=== 示例6：状态监控 ===");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 3,
  });

  // 添加事件监听器
  agent.on("task:start", (taskId) => {
    console.log(`调试：任务开始 ${taskId}`);
  });

  agent.on("task:complete", (taskId, result) => {
    console.log(`调试：任务完成 ${taskId}`);
    console.log("当前状态:", agent.getStatus());
  });

  try {
    // 执行多个任务
    await agent.execute({
      task: "查找所有.js文件",
      context: { projectPath: "." },
    });

    console.log("最终状态:", agent.getStatus());
  } catch (error) {
    console.error("调试示例失败:", error.message);
  }
}

/**
 * 示例7：错误处理和恢复
 */
async function errorHandlingExample() {
  console.log("\n=== 示例7：错误处理 ===");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 5,
  });

  try {
    // 尝试读取不存在的文件
    const result = await agent.execute({
      task: "读取不存在的文件nonexistent.txt",
      context: { projectPath: "." },
    });

    console.log("错误处理结果:", result);
  } catch (error) {
    console.error("预期错误:", error.message);
  }
}

/**
 * 主运行函数
 */
async function runAllExamples() {
  console.log("🤖 Work Agent使用示例开始\n");

  try {
    // 依次运行所有示例
    await basicFileOperations();
    await projectAnalysis();
    await llmEnhancedExample();
    await concurrentTasks();
    await customToolExample();
    await debuggingExample();
    await errorHandlingExample();

    console.log("\n✅ 所有示例运行完成！");
  } catch (error) {
    console.error("❌ 示例运行失败:", error);
  }
}

/**
 * 快速测试函数
 */
async function quickTest() {
  console.log("🧪 快速测试开始...");

  const agent = new WkAgent({
    enableLearning: true,
    maxConcurrency: 3,
  });

  try {
    const result = await agent.execute({
      task: "列出当前目录下所有文件",
      context: { projectPath: "." },
    });

    console.log("快速测试结果:", result.summary);
    console.log("可用工具:", agent.getAvailableTools());
  } catch (error) {
    console.error("快速测试失败:", error.message);
  }
}

// 导出函数供其他模块使用
module.exports = {
  basicFileOperations,
  projectAnalysis,
  llmEnhancedExample,
  concurrentTasks,
  customToolExample,
  debuggingExample,
  errorHandlingExample,
  runAllExamples,
  quickTest,
};

// 如果直接运行此文件
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--all")) {
    runAllExamples();
  } else if (args.includes("--quick")) {
    quickTest();
  } else {
    console.log("使用方法:");
    console.log("  node examples.js --all    # 运行所有示例");
    console.log("  node examples.js --quick  # 快速测试");
    console.log("");
    console.log("也可以导入特定函数:");
    console.log('  const { basicFileOperations } = require("./examples");');
  }
}
