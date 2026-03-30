# ClawX Fork 用户指南

> 本文档描述了在 ClawX Fork 中新增的两个功能：Agent 级别 LLM API Key 配置和 Skill 自动更新按钮。

---

## 目录

1. [项目概述](#1-项目概述)
2. [Feature 1：Agent 级别 LLM API Key 配置](#2-feature-1agent-级别-llm-api-key-配置)
3. [Feature 2：Skill 自动更新按钮](#3-feature-2skill-自动更新按钮)
4. [安装和构建指南](#4-安装和构建指南)
5. [常见问题解答](#5-常见问题解答)

---

## 1. 项目概述

### 1.1 什么是 ClawX Fork

ClawX（原名 Golutra）是一款 AI Agent 工作区管理桌面应用，基于 [OpenClaw](https://github.com/OpenClaw) 构建。

**官方仓库**：https://github.com/ValueCell-ai/ClawX

### 1.2 为什么需要 Fork

我们对 ClawX 进行了二次开发，新增了两个实用功能：

| 功能 | 说明 |
|------|------|
| **Feature 1** | Agent 级别 LLM API Key 配置 - 支持为不同 Agent 绑定不同的 API Key |
| **Feature 2** | Skill 自动更新按钮 - 一键更新已安装的 Skills 至最新版本 |

### 1.3 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     用户界面 (React)                     │
├─────────────────────────────────────────────────────────┤
│              前端状态管理 (Zustand Stores)              │
├─────────────────────────────────────────────────────────┤
│              Electron API Routes                        │
│         /api/clawhub/*  /api/providers/*               │
├─────────────────────────────────────────────────────────┤
│              Electron Services                          │
│      ClawHubService     ProviderService                │
├─────────────────────────────────────────────────────────┤
│              OpenClaw Gateway (Node.js)                │
├─────────────────────────────────────────────────────────┤
│              OS Keychain / 本地配置文件                 │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Feature 1：Agent 级别 LLM API Key 配置

### 2.1 功能说明

**问题背景**：
在原始 ClawX 中，所有 Agent 共享全局的 Provider Account。这意味着如果你有多个 AI 供应商账户（如不同的 OpenAI API Key），无法为不同的 Agent 指定使用不同的 Key。

**解决方案**：
我们在 Agent 配置中添加了 `providerAccountId` 字段，允许你为每个 Agent 绑定特定的 API Key。

### 2.2 使用方法

#### 步骤 1：配置 Provider 账户

1. 打开 ClawX，进入 **设置（Settings）**
2. 选择 **Providers（供应商）** 选项卡
3. 点击 **Add Provider** 添加账户
4. 填写供应商信息：
   - **Vendor**：选择 `openai`、`anthropic` 等
   - **API Key**：输入你的 API Key
   - **Label**：给账户起个名字（如"工作账户"）
   - **Default Model**：选择默认模型

#### 步骤 2：为 Agent 选择 Provider 账户

1. 进入 **Agents（智能体）** 页面
2. 点击要配置的 Agent 卡片
3. 在详情面板中找到 **Provider Account** 下拉框
4. 选择之前配置的 Provider 账户
5. 保存设置

#### 步骤 3：验证配置

1. 在 Agent 对话框中发送一条消息
2. 观察使用的是否是你指定的 API Key 对应的模型

### 2.3 技术实现细节

#### 数据结构变更

**Agent 配置**（`~/.openclaw/openclaw.json`）：

```json
{
  "agents": {
    "list": [
      {
        "id": "agent-1",
        "name": "工作助手",
        "providerAccountId": "provider-account-id-here",
        "model": "gpt-4"
      }
    ]
  }
}
```

#### 关键代码位置

| 文件 | 说明 |
|------|------|
| `src/stores/agents.ts` | Agent 状态管理，新增 `providerAccountId` 支持 |
| `src/pages/Agents/index.tsx` | Agent 管理界面，添加 Provider 选择器 |
| `electron/api/routes/agents.ts` | Agent API 路由 |
| `electron/stores/providers.ts` | Provider 账户存储逻辑 |

#### 配置文件备份

每次修改 Agent 配置前，应用会自动备份旧配置到：
```
~/.openclaw/.backups/agents/
```

---

## 3. Feature 2：Skill 自动更新按钮

### 3.1 功能说明

**问题背景**：
从 ClawHub 安装的 Skill，安装后版本号固定不变，无法自动获取更新。每次官方 Skill 更新后，用户需要手动卸载再重装，导致配置丢失。

**解决方案**：
我们为每个已安装的 Skill 添加了「更新」按钮，点击即可一键更新到最新版本，同时保留用户配置。

### 3.2 使用方法

#### 步骤 1：打开 Skills 页面

1. 在 ClawX 左侧导航栏点击 **Skills（技能）**
2. 查看已安装的 Skill 列表

#### 步骤 2：更新单个 Skill

1. 找到要更新的 Skill（非核心、非内置的第三方 Skill）
2. 在 Skill 卡片的右侧，找到绿色的 **「更新」按钮**
3. 点击按钮，等待更新完成

#### 步骤 3：验证更新

- 成功更新后，会显示 toast 提示：「技能已从 v1.0.0 更新至 v1.1.0」
- 如果已是最新版本，提示：「技能已是最新版本」

### 3.3 界面截图位置描述

```
┌─────────────────────────────────────────────────────────┐
│  Skills                                    [刷新] [安装]│
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐  │
│  │ 🧩 weather         v1.2.0    [更新]  ●──────── │  │
│  │    天气查询技能                            启用    │  │
│  └─────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 🔍 web-search     v2.0.1    [更新]  ●──────── │  │
│  │    网络搜索技能                            启用    │  │
│  └─────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 📊 data-analysis  v1.5.0    [更新]  ●──────── │  │
│  │    数据分析技能                            启用    │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              ▲
                         更新按钮位置
```

### 3.4 技术实现细节

#### 更新流程

```
1. 用户点击「更新」按钮
         ↓
2. 调用 /api/clawhub/update 接口
         ↓
3. ClawHubService.update() 执行：
   a. 获取当前版本号
   b. 执行 clawhub update <slug> 命令
   c. 获取新版本号
   d. 保留用户配置文件（不覆盖）
         ↓
4. 刷新 Skills 列表
         ↓
5. 显示更新结果 toast
```

#### 关键代码位置

| 文件 | 说明 |
|------|------|
| `electron/gateway/clawhub.ts` | `update()` 方法，运行 `clawhub update` |
| `electron/api/routes/skills.ts` | `/api/clawhub/update` 路由 |
| `src/stores/skills.ts` | `updateSkillFromApi()` 方法 |
| `src/pages/Skills/index.tsx` | 更新按钮 UI 和 `handleUpdate()` |

#### 配置文件保留机制

Skill 的用户配置独立存储，不会被更新覆盖：

```
~/.openclaw/.skills-config/<skill-name>/
├── config.json      # 用户 API Key 等配置
└── env.json        # 环境变量配置
```

#### 相关 Git Commit

- **Feature 2 核心代码**：Commit `b37b57f`
- **i18n 翻译**：Commit `96d9752`

---

## 4. 安装和构建指南

### 4.1 环境要求

| 依赖 | 版本要求 |
|------|----------|
| Node.js | >= 18.x |
| pnpm | >= 8.x |
| Rust | >= 1.70（用于 Tauri） |
| macOS / Windows / Linux | 均可 |

### 4.2 安装步骤

#### 1. 克隆仓库

```bash
git clone https://github.com/ValueCell-ai/ClawX.git
cd ClawX
```

#### 2. 安装依赖

```bash
pnpm install
```

#### 3. 配置开发环境

```bash
cp .env.example .env
# 编辑 .env 文件，填入必要的配置
```

#### 4. 运行开发版本

```bash
pnpm run dev
```

#### 5. 构建生产版本

```bash
pnpm run build
```

构建产物位于：
- macOS：`dist-mac/ClawX.app`
- Windows：`dist-win/ClawX.exe`
- Linux：`dist-linux/ClawX`

### 4.3 与上游同步

我们定期与官方 ClawX 仓库同步：

```bash
# 添加上游仓库（如果尚未添加）
git remote add upstream https://github.com/ValueCell-ai/ClawX.git

# 获取上游更新
git fetch upstream

# 合并到你的分支
git merge upstream/main
```

### 4.4 常见构建问题

| 问题 | 解决方案 |
|------|----------|
| `node-gyp` 编译失败 | 安装 Xcode Command Line Tools |
| Tauri 构建失败 | 安装 Rust：`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| pnpm 安装失败 | 确保使用 pnpm 8.x：`npm i -g pnpm@8` |

---

## 5. 常见问题解答

### Q1：Feature 1 和 Feature 2 的代码在哪里？

**A**：所有代码已在 GitHub 仓库中：
- Agent API Key 配置：`src/stores/agents.ts`、`src/pages/Agents/index.tsx`
- Skill 更新功能：`electron/gateway/clawhub.ts`、`src/stores/skills.ts`

### Q2：更新 Skill 会丢失我的配置吗？

**A**：不会。用户的 API Key、环境变量等配置独立存储在 `~/.openclaw/.skills-config/` 目录，更新过程不会覆盖这些文件。

### Q3：如何回退到旧版本？

**A**：
1. 找到备份目录 `~/.openclaw/.backups/`
2. 恢复对应的配置文件
3. 重启 ClawX

### Q4：为什么我的 Skill 没有显示更新按钮？

**A**：更新按钮只显示给：
- 非核心的 Skill（`isCore: false`）
- 非内置的 Skill（`isBundled: false`）
- 来自市场的第三方 Skill

### Q5：GitHub 推送失败怎么办？

**A**：可能是 HTTPS 认证问题。解决方案：

**方案 1：配置 SSH**
```bash
git remote set-url origin git@github.com:ValueCell-ai/ClawX.git
```

**方案 2：配置 Personal Access Token**
```bash
git remote set-url origin https://<YOUR_TOKEN>@github.com/ValueCell-ai/ClawX.git
```

### Q6：如何报告问题或贡献代码？

**A**：
1. 在 GitHub 仓库提交 Issue
2. Fork 仓库，创建特性分支
3. 提交 Pull Request

---

## 附录

### A. 相关文件路径

| 用途 | 路径 |
|------|------|
| OpenClaw 配置 | `~/.openclaw/openclaw.json` |
| Skills 根目录 | `~/.openclaw/skills/` |
| Skill 备份目录 | `~/.openclaw/.backups/` |
| Skill 配置目录 | `~/.openclaw/.skills-config/` |
| ClawHub Lock | `~/.openclaw/.clawhub/lock.json` |

### B. CLI 命令参考

```bash
# Skills 管理
clawhub search <keyword>    # 搜索 Skills
clawhub install <slug>       # 安装 Skill
clawhub list                 # 列出已安装
clawhub update <slug>        # 更新 Skill（新增）

# Agent 管理
openclaw agents list         # 列出 Agents
openclaw agents add          # 添加 Agent
```

### C. 联系方式

- GitHub Issues：https://github.com/ValueCell-ai/ClawX/issues
- 项目主页：https://clawx.ai

---

*文档最后更新：2026-03-30*
