# 可复现测试

应用本身零运行依赖，直接打开 index.html 即可；不要为运行页面安装本目录依赖。

本目录是独立 DOM/逻辑回归工具。实测环境为 Node v24.19.0、jsdom 30.1.3。该 jsdom 版本需要 Node ^22.22.2、^24.15.0 或 >=26.0.0；应用的可选静态服务器仍支持 Node >=18。

复现（需要访问 npm 官方仓库）：

```sh
cd tests
npm install --ignore-scripts
npm test
```

测试根目录由脚本文件相对位置推导，不依赖原开发机器路径。tests/node_modules 是可删除的测试依赖，不需要随应用分发。

- test.cjs：23组启动、导航、工单、模型、存储、导出与安全检查。
- extra.cjs：7组拓扑、搜索分页、质量降级、配置及输入检查。
- consistency.cjs：5组SVG数值与测点、预测区间、能耗及质量数量一致性。
- buttons.cjs：初始状态12模块的95个内容区按钮独立点击，捕获运行错误。
- server-test.cjs：7个静态服务器处理器测试（使用模拟请求，不监听端口）。
- *results.json：本次测试记录。复现会覆盖本地结果文件。

harness.cjs模拟dialog、滚动、下载及URL.createObjectURL，并禁止fetch/XHR/WebSocket。下载测试验证导出函数与生成对象，不能验证操作系统保存流程。file://测试使用jsdom URL语义及存储降级，不是浏览器双击实测。SVG测试核对生成坐标，不是屏幕截图或布局测试。

实际HTTP与尚未完成的浏览器测试边界，详见 ../docs/TEST_REPORT.md。
