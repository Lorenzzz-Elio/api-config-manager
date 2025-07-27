# API配置管理器 (API Config Manager)

一个强大的SillyTavern扩展，用于保存和管理多个API配置，支持一键快速切换。

## ✨ 功能特性

- 🔧 **多配置管理**: 保存无限个API配置（URL、密钥、首选模型）
- ⚡ **一键切换**: 快速应用任意配置并自动连接
- 🤖 **智能模型选择**: 自动获取和选择API支持的模型
- 🔄 **自动重连**: 应用配置后自动重新连接API
- 📱 **响应式设计**: 完美支持桌面和移动设备
- 🔒 **隐私保护**: 所有数据仅存储在本地，绝不上传
- 🎯 **智能位置**: 优先在API连接界面显示，更符合使用习惯

## 🚀 快速安装

### 方法1：通过Git URL安装（推荐）
1. 打开SillyTavern
2. 进入 **扩展设置** 页面
3. 找到 **"Install Extension"** 或 **"安装扩展"**
4. 输入以下Git URL：
```
https://github.com/Lorenzzz-Elio/api-config-manager.git
```
5. 点击安装，重启SillyTavern

### 方法2：手动安装
1. 下载本仓库的所有文件
2. 将文件夹放置到 `SillyTavern/public/scripts/extensions/api-config-manager/`
3. 重启SillyTavern
4. 在扩展设置中启用"API Config Manager"

## 📖 使用指南

### 保存API配置
1. 在API连接界面或扩展设置中找到"API配置管理器"
2. 填写配置信息：
   - **配置名称**: 如"OpenAI GPT-4"、"Claude API"、"本地Ollama"等
   - **API URL**: 如"https://api.openai.com/v1"
   - **API密钥**: 您的API密钥（可选）
   - **首选模型**: 如"gpt-4"、"claude-3-sonnet"等（可选）
3. 点击"获取模型"可自动获取API支持的模型列表
4. 点击"保存配置"

### 使用已保存的配置
1. 在配置列表中找到要使用的配置
2. 点击"应用"按钮
3. 扩展将自动：
   - 设置API URL和密钥
   - 重新连接到API
   - 选择指定的模型（如果设置了）

### 管理配置
- **编辑**: 点击"编辑"按钮修改配置
- **删除**: 点击"删除"按钮移除不需要的配置
- **应用**: 点击"应用"按钮快速切换到该配置

## 🔒 隐私与安全

### 完全本地存储
- ✅ 所有配置数据仅存储在您的本地浏览器中
- ✅ 不会向任何外部服务器发送您的API密钥
- ✅ 扩展代码开源，可自由审查

### Git发布安全
- ✅ 发布到Git的代码不包含任何用户数据
- ✅ 其他人安装时获得的是空白配置管理器
- ✅ 绝对不会泄露您的API密钥或配置信息

详细隐私说明请查看 [PRIVACY.md](PRIVACY.md)

## 🎯 支持的API类型

本扩展支持所有OpenAI兼容的API，包括但不限于：

- **OpenAI**: GPT-4, GPT-3.5等
- **Anthropic**: Claude系列
- **本地部署**: Ollama, LM Studio, Text Generation WebUI等
- **云服务**: OpenRouter, Together AI, Groq等
- **自定义API**: 任何OpenAI兼容的API端点

## 📱 设备兼容性

- ✅ **桌面浏览器**: Chrome, Firefox, Safari, Edge
- ✅ **移动设备**: iOS Safari, Android Chrome
- ✅ **平板设备**: iPad, Android平板
- ✅ **响应式设计**: 自动适配各种屏幕尺寸

## 🛠️ 技术特性

- **轻量级**: 纯JavaScript，无外部依赖
- **高性能**: 快速加载，流畅操作
- **兼容性**: 支持SillyTavern 1.12.14+
- **可扩展**: 模块化设计，易于维护和扩展

## 📋 更新日志

### v1.0.0 (2024-07-27)
- 🎉 首次发布
- ✨ 支持多配置管理
- ✨ 一键切换功能
- ✨ 自动模型获取
- ✨ 响应式设计
- ✨ 隐私保护机制

## 🤝 贡献

欢迎提交Issue和Pull Request！

### 开发环境
1. Fork本仓库
2. 克隆到本地SillyTavern扩展目录
3. 进行修改和测试
4. 提交Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

感谢SillyTavern团队提供的优秀扩展框架！

---

**如果这个扩展对您有帮助，请给个⭐Star支持一下！**

### 5. 删除配置
1. 在配置列表中找到要删除的配置
2. 点击"删除"按钮
3. 确认删除操作

## 技术说明

### 支持的API字段
- **Custom API URL**: `#custom_api_url_text`
- **Custom API Key**: `#api_key_custom` (通过secrets系统)
- **Custom Model**: `#custom_model_id` 和 `#model_custom_select`

### 自动化功能
- **自动连接**: 应用配置后自动触发 `$('#api_button_openai').trigger('click')`
- **模型选择**: 如果指定了首选模型，会自动设置到相应字段
- **智能匹配**: 优先从模型列表中选择，如果不存在则手动设置模型ID

### 数据存储
配置数据存储在SillyTavern的`extension_settings`中，格式如下：
```json
{
  "api-config-manager": {
    "configs": [
      {
        "name": "配置名称",
        "url": "API URL",
        "key": "API密钥"
      }
    ]
  }
}
```

### 文件结构
```
api-config-manager/
├── manifest.json      # 扩展清单文件
├── index.js          # 主要JavaScript代码
├── settings.html     # HTML模板
├── style.css         # 样式文件
└── README.md         # 说明文档
```

## 注意事项

1. **安全性**: API密钥以明文形式存储在本地设置中，请确保设备安全
2. **兼容性**: 目前仅支持Custom OpenAI API配置字段
3. **备份**: 建议定期备份SillyTavern设置以防配置丢失

## 版本信息

- **版本**: 1.0.0
- **作者**: Lorenzzz-Elio
- **许可**: MIT License

## 故障排除

### 扩展未显示
1. 检查文件是否正确放置在扩展目录中
2. 确认扩展已在设置中启用
3. 刷新页面重新加载扩展

### 配置无法保存
1. 确认当前有有效的API URL或密钥
2. 检查配置名称是否为空
3. 查看浏览器控制台是否有错误信息

### 应用配置无效
1. 确认目标API字段存在于当前页面
2. 检查是否在正确的API设置页面
3. 尝试手动刷新页面
