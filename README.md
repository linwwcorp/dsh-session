# dsh-session

一个 DeepSeek Harness 插件：在工具权限审批卡片上增加「允许当前对话」。

A DeepSeek Harness bundle that adds **Allow this conversation** to tool approval prompts.

## 行为 / Behavior

- 点击「允许当前对话」会批准当前这条申请，并在本轮回答结束前自动批准同一会话后续的权限申请，所以同一个问题里反复出现的权限提示只会问一次。
- 点击「允许一次」只批准当前这条申请。
- 点击「拒绝」拒绝当前这条申请。
- 授权只存在于浏览器内存，不写入会话日志；宿主仍然逐条记录询问与 `allowed-once` 结果。
- 本轮结束、停止或失败时授权自动失效，下一次提问重新询问；授权不跨会话。
- 键盘：聚焦卡片后按 Enter 等同「允许一次」，按 Esc 等同「拒绝」。

## 安装 / Install

安装地址：

```
https://github.com/linwwcorp/dsh-session
```

在 Harness 的 Plugin Manager 里选择安装插件，把上面的地址粘贴到安装输入框即可；也可以直接用命令行安装到当前 profile：

```sh
dsh plugin install https://github.com/linwwcorp/dsh-session
```

本地开发时可以直接安装工作目录：

```sh
dsh plugin install /root/CODE/dsh-session
```

或通过 Plugin Manager 的 `install_bundle` 操作，目标传入上面的 GitHub 地址或本地目录的绝对路径。

## 结构 / Layout

| 文件 | 作用 |
| --- | --- |
| `cordis.patch.yml` | 插入 `dsh-session` 插件行 |
| `index.js` | Host 半边，无 Host 能力，只有空 `apply` |
| `client.js` | 浏览器半边，注册 `conversation.composer` 链式插槽上的审批卡片 |
| `locale/en.json`、`locale/zh.json` | Plugin Manager 中显示的标题与说明 |
| `icon.svg` | 插件图标 |

## 说明 / Notes

卡片以 `priority: 0.5` 注册在 `conversation.composer` 上，排在 Harness 自带的审批入口（priority 1）之前，因此审批提示由本插件呈现；其他待处理交互（例如提问、计划确认）不受影响。
