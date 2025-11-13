# Project Context

## Purpose
这是一个文档托管分享的思源笔记插件，用于在思源笔记中分享文档，支持图片、多维表、折叠块、嵌入块等特性，实现一键分享功能。

## Tech Stack
- **编程语言**: TypeScript
- **前端框架**: Svelte 4
- **构建工具**: Vite 5
- **样式预处理器**: Stylus
- **测试框架**: Vitest
- **包管理工具**: pnpm
- **代码规范**: ESLint, Prettier
- **国际化支持**: i18n

## Project Conventions

### Code Style
- 使用 TypeScript 进行类型安全的开发
- 遵循 ESLint 推荐配置和 TypeScript 推荐配置
- 使用 Prettier 保持一致的代码格式化
- 类名采用 PascalCase 命名规范
- 方法和变量采用 camelCase 命名规范
- 常量使用全大写加下划线命名规范
- 文件结构遵循功能模块化组织
- 每个文件开头包含版权声明和许可证信息

### Architecture Patterns
- **面向对象设计**: 使用类和继承组织代码结构
- **服务层模式**: 通过 Service 类封装业务逻辑
- **组合式 API**: 使用 composables 封装可复用的功能
- **模型层**: 使用 TypeScript 接口和类定义数据模型
- **工具函数**: 将通用功能抽象为独立的工具模块
- **插件生命周期**: 遵循思源笔记插件的加载和卸载生命周期

### Testing Strategy
- 使用 Vitest 作为测试框架
- 支持监视模式进行开发测试
- 测试文件应与被测试文件放在同一目录下，命名为 `.test.ts`
- 鼓励编写单元测试确保代码质量

### Git Workflow
- 使用 GitHub Actions 进行 CI/CD 自动化
- 采用 release-please 进行版本管理和发布
- 使用 dependabot 进行依赖管理和更新
- 遵循标准的 Git 工作流程，使用功能分支开发
- 代码提交前应通过 ESLint 和 Prettier 检查

## Domain Context
- **思源笔记**: 这是一个本地优先的知识管理系统，使用块级存储
- **文档分享**: 将本地笔记发布到外部服务器，生成可公开访问的链接
- **块类型**: 支持多种块类型的渲染，包括文本块、图片块、多维表块、折叠块、嵌入块等
- **分享配置**: 支持针对单个文档的分享设置，如访问权限、密码保护等
- **媒体处理**: 自动处理文档中的图片等媒体资源
- **VIP 功能**: 提供增强的分享功能，如自定义域名、高级权限管理等

## Important Constraints
- **思源笔记版本依赖**: 最低支持思源笔记 3.0.0 版本
- **多平台支持**: 需兼容 Windows、Linux、macOS 和 Docker 后端
- **多前端支持**: 需兼容桌面端、移动端和浏览器端
- **国际化要求**: 支持英文和中文两种语言
- **API 兼容性**: 需保持与思源笔记 API 的兼容性
- **性能考虑**: 确保分享功能不影响思源笔记的整体性能

## External Dependencies
- **zhi-lib-base**: 提供基础工具函数和日志系统
- **zhi-siyuan-api**: 思源笔记 API 的封装库
- **zhi-blog-api**: 博客和内容发布相关的 API 封装
- **cheerio**: HTML 解析和操作库，用于处理文档内容
- **copy-to-clipboard**: 复制文本到剪贴板功能
- **share-api**: 内部开发的分享服务 API
- **siyuan**: 思源笔记的核心库，提供插件接口
