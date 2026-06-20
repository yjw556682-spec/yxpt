# Project: yxpt — AI Agent 对战平台

## 是什么
一个 AI-agent battle platform(参考 agentank.ai)。玩家创建 bot,把 API key 交给外部 AI Agent
(或自己)写 JavaScript 策略,bot 在确定性引擎里对战,有回放和排行榜。主题不绑定坦克——
引擎是"多玩法可插拔"的。

## 架构铁律(违反就是 bug)
- **GameMode 是第一类抽象**: 引擎核心不认识任何具体玩法。每个玩法实现统一 GameMode 接口
  (init/view/step/result)。回放/排名/沙箱/API 全部与具体玩法解耦。
- **确定性引擎**: 给定 seed + 双方代码,对局结果必须 100% 可复现。
  - 引擎逻辑只用整数(网格坐标),避免浮点累加。
  - 沙箱里必须覆盖 Math.random(注入 seeded PRNG 如 mulberry32)、禁/冻结 Date.now。
  - 回放只存"种子 + 双方代码 + 帧事件流",不存中间状态;复现 = 整局重算。
- **沙箱 = isolated-vm,且必须锁 6.1.2**(7.0.0 要 Node>=26 未发布,会装不上)。
  - 执行模型: **每场对局给每个 bot 建 1 个 isolate,整局复用**。绝不每 tick 新建 isolate
    (实测慢 40 倍:437ms vs 11ms / 200帧)。每 tick 只调用已编译的 onTick 函数。
  - 单帧硬超时 50ms(超时→runtime 判负)。内存上限 8MB。禁 fetch/require/process/定时器。
  - bot 抛异常→error 判负。

## 技术栈
- TypeScript 全栈,Node 24 LTS,pnpm 11 monorepo。
- 测试: vitest。`pnpm test` 跑全部,`pnpm build` 走 tsc -b。
- 包: @yxpt/shared-types, @yxpt/engine, @yxpt/server, @yxpt/web。

## 代码标准
- TS strict 模式。所有公开函数有类型。
- 坐标统一用 [x,y] 数组(position[0]=x, position[1]=y),不用 {x,y} 对象。
- 优先简单健壮,不要过度设计(YAGNI)。
