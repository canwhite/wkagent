/**
 * Node.js构建版本测试
 */

const WkAgent = require('./dist/wkagent.node.js');

async function testNodeBuild() {
    console.log('Testing Node.js build...');
    
    try {
        const agent = new WkAgent({
            maxConcurrency: 2
        });

        console.log('Agent created successfully');
        console.log('Agent status:', agent.getStatus());

        const result = await agent.execute({
            task: "创建测试文件",
            context: {
                filePath: 'test-node.txt',
                content: 'Hello from Node.js build!'
            }
        });

        console.log('Test completed:');
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('Test failed:', error);
    }
}

if (require.main === module) {
    testNodeBuild();
}

module.exports = { testNodeBuild };