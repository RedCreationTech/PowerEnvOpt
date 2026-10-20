# 模型服务兼容范围

本项目使用 OpenAI-compatible Chat Completions 的非流式 JSON 响应：`stream: false`、`response_format: {type: "json_object"}`。配置模型名称不等于该模型已验证兼容。未执行任何真实付费模型调用；连接与质量需用户配置后分别验证。

## Qwen

默认模型为 `qwen-plus`。请求显式设置 `enable_thinking: false`，让支持切换的混合思考模型直接返回内容。阿里云文档说明 `qwen-plus` 默认不启用思考，但其他混合模型默认值可能不同。

仅使用同时支持关闭思考、非流式 Chat Completions 和 JSON 输出的模型。仅思考模式、仅流式输出、需要其他协议或不支持此参数/JSON 模式的模型不属于本适配器支持范围。模型不兼容时报告服务错误，不静默改用其他模型、关闭验证或改成 SSE。未来模型是否兼容必须依据对应模型文档及实际连接测试。

Qwen 密钥与地域必须匹配；工作区专属域名可在服务器配置中填写，域名须通过官方地址白名单。

## DeepSeek 与本地服务

DeepSeek 不接收 Qwen 专用 `enable_thinking` 字段；使用所选模型的 JSON Chat Completions 协议。可配置模型并不代表任意模型、思考模式或 API 版本均受支持。

本地服务须位于回环地址，支持上述完整请求和 JSON 返回格式。不支持 JSON 模式或只支持流式输出的本地模型需要单独适配，本项目不会伪造成功响应。

## 官方依据

核对日期：2026-10-20。

- [Alibaba Cloud: Deep thinking](https://www.alibabacloud.com/help/en/model-studio/deep-thinking)
- [Alibaba Cloud: OpenAI-compatible Chat](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope)
- [DeepSeek: Your First API Call](https://api-docs.deepseek.com/)

参数测试使用本地/注入的假服务，不代表真实供应商可用性或模型精度。
