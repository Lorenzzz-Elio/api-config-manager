# API配置管理器 - 隐私保护说明

## 概述

API配置管理器是一个SillyTavern扩展，用于管理多个API配置。本文档详细说明了扩展的隐私保护机制。

## 数据存储位置

### 本地存储
- **存储位置**: 所有配置数据都存储在用户的本地浏览器中
- **存储方式**: 使用SillyTavern的`extension_settings`机制
- **存储内容**: 配置名称、API URL、API密钥、首选模型

### 不会上传到Git
- 配置数据**不会**包含在扩展的源代码中
- 当您将扩展发布到Git时，只会包含代码文件，不包含任何用户数据
- 其他用户安装您的扩展时，会得到一个空白的配置管理器

## 隐私保护机制

### 1. 本地存储隔离
```javascript
// 数据存储在用户本地的extension_settings中
extension_settings[MODULE_NAME] = {
    configs: [] // 用户的配置数据
};
```

### 2. 界面隐私保护
- **不显示敏感信息**: 扩展列表中不显示API URL和密钥
- **只显示必要信息**: 仅显示配置名称和模型信息
- **密钥保护**: 编辑时密钥字段为密码类型，不会明文显示

### 3. 代码分离
- **配置数据**: 存储在用户本地，不包含在代码中
- **扩展代码**: 只包含功能逻辑，不包含任何配置数据
- **Git发布**: 只上传代码文件，配置数据永远不会被提交

## 安全保证

### 对扩展开发者
- ✅ 您可以安全地将扩展发布到Git
- ✅ 不会意外泄露用户的API密钥
- ✅ 不会暴露用户的API URL
- ✅ 代码和数据完全分离

### 对扩展用户
- ✅ 您的API密钥只存储在本地
- ✅ 其他人无法通过Git获取您的配置
- ✅ 配置数据不会被意外分享
- ✅ 完全的隐私控制

## 文件结构

```
api-config-manager/
├── index.js          # 主要功能代码 (会上传到Git)
├── settings.html     # 界面模板 (会上传到Git)
├── style.css         # 样式文件 (会上传到Git)
├── manifest.json     # 扩展清单 (会上传到Git)
├── README.md         # 说明文档 (会上传到Git)
├── PRIVACY.md        # 隐私说明 (会上传到Git)
└── [用户配置数据]    # 存储在浏览器中 (不会上传到Git)
```

## 使用建议

### 发布扩展到Git
1. 确保只提交代码文件
2. 不要提交任何包含配置数据的文件
3. 在`.gitignore`中排除配置文件（如果有的话）

### 安装他人的扩展
1. 通过Git URL安装是安全的
2. 您会得到一个干净的扩展，没有他人的配置
3. 需要重新添加您自己的API配置

## 技术实现

### 数据隔离
```javascript
// 每个用户的数据都是独立的
const MODULE_NAME = 'api-config-manager';
const userConfigs = extension_settings[MODULE_NAME]?.configs || [];
```

### 界面保护
```javascript
// 不显示敏感信息
const configItem = $(`
    <div class="api-config-item">
        <div class="api-config-info">
            <div class="api-config-name">${config.name}</div>
            ${config.model ? 
                `<div class="api-config-model">首选模型: ${config.model}</div>` : 
                '<div class="api-config-no-model">未设置模型</div>'
            }
        </div>
        <!-- 不显示URL和密钥 -->
    </div>
`);
```

## 常见问题

**Q: 我的API密钥会被泄露吗？**
A: 不会。API密钥只存储在您的本地浏览器中，不会包含在Git代码中。

**Q: 其他人安装我的扩展会看到我的配置吗？**
A: 不会。他们只会得到扩展的功能代码，需要添加自己的配置。

**Q: 我可以安全地分享扩展代码吗？**
A: 可以。扩展代码不包含任何用户数据，可以安全分享。

**Q: 如何备份我的配置？**
A: 配置存储在浏览器的extension_settings中，您可以通过SillyTavern的设置导出功能进行备份。

## 总结

API配置管理器采用了严格的隐私保护机制，确保：
- 用户数据只存储在本地
- 代码和数据完全分离
- Git发布不会泄露隐私
- 用户拥有完全的数据控制权

这种设计确保了扩展既实用又安全，您可以放心使用和分享。
