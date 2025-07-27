# 发布指南

## 准备发布到GitHub

### 1. 在GitHub上创建新仓库

1. 登录 [GitHub](https://github.com)
2. 点击右上角的 "+" 按钮，选择 "New repository"
3. 填写仓库信息：
   - **Repository name**: `api-config-manager`
   - **Description**: `A SillyTavern extension for managing multiple API configurations`
   - **Visibility**: 选择 **Public** (这样其他人才能通过URL安装)
   - **不要勾选** "Add a README file" (我们已经有了)
   - **不要勾选** "Add .gitignore" (我们已经有了)
   - **License**: 选择 "MIT License"
4. 点击 "Create repository"

### 2. 上传代码到GitHub

在扩展文件夹中执行以下命令：

```bash
# 进入扩展目录
cd "public/scripts/extensions/api-config-manager"

# 初始化Git仓库
git init

# 添加所有文件
git add .

# 提交代码
git commit -m "🎉 Initial release of API Config Manager v1.0.0

✨ Features:
- Multiple API configuration management
- One-click configuration switching
- Automatic model detection and selection
- Responsive design for all devices
- Complete privacy protection
- Smart positioning in API connection interface

🔒 Privacy:
- All data stored locally
- No user data in repository
- Safe for public sharing"

# 添加远程仓库
git remote add origin https://github.com/Lorenzzz-Elio/api-config-manager.git

# 设置主分支
git branch -M main

# 推送到GitHub
git push -u origin main
```

### 3. 创建Release (可选但推荐)

1. 在GitHub仓库页面点击 "Releases"
2. 点击 "Create a new release"
3. 填写信息：
   - **Tag version**: `v1.0.0`
   - **Release title**: `API Config Manager v1.0.0 - Initial Release`
   - **Description**: 复制以下内容

```markdown
## 🎉 首次发布！

API配置管理器是一个强大的SillyTavern扩展，让您轻松管理和切换多个API配置。

### ✨ 主要功能
- 🔧 多配置管理：保存无限个API配置
- ⚡ 一键切换：快速应用任意配置
- 🤖 智能模型选择：自动获取支持的模型
- 📱 响应式设计：完美支持所有设备
- 🔒 隐私保护：数据仅存储在本地

### 🚀 安装方法
在SillyTavern扩展设置中输入以下Git URL：
```
https://github.com/Lorenzzz-Elio/api-config-manager.git
```

### 📖 使用说明
详细使用方法请查看 [README.md](README.md)

### 🔒 隐私保证
- 所有配置数据仅存储在您的本地浏览器中
- 不会向任何服务器发送您的API密钥
- 扩展代码完全开源，可自由审查

**如果觉得有用，请给个⭐Star支持！**
```

4. 点击 "Publish release"

## 安装URL

发布完成后，您的扩展安装URL将是：

```
https://github.com/Lorenzzz-Elio/api-config-manager.git
```

## 宣传建议

### 在SillyTavern社区分享
1. **Reddit**: r/SillyTavernAI
2. **Discord**: SillyTavern官方服务器
3. **GitHub**: SillyTavern主仓库的Discussions

### 分享模板
```
🎉 新扩展发布：API配置管理器

厌倦了频繁手动切换API配置？这个扩展可以帮您：
✨ 保存多个API配置
⚡ 一键快速切换
🤖 自动选择模型
📱 完美移动端支持

安装URL：https://github.com/Lorenzzz-Elio/api-config-manager.git

完全开源，隐私安全！
```

## 维护建议

1. **定期更新**: 根据用户反馈改进功能
2. **版本管理**: 使用语义化版本号 (v1.0.0, v1.1.0等)
3. **文档维护**: 保持README和文档的更新
4. **社区互动**: 及时回复Issues和Pull Requests

祝您的扩展发布成功！🚀
