import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  User,
  MessageSquare,
  ChevronRight,
  Send,
  Settings,
  Upload,
  Save,
  LoaderCircle,
} from "lucide-react";
import { trpc } from "@/providers/trpc";

import { SimpleMarkdown } from "./SimpleMarkdown";

/** 系统提示词：数字分身的人格与知识库 */
const buildSystemPrompt = () => `你是这份简历的主人本人，一位拥有10年客户端研发经验、7年快手直播核心业务实战经验的移动端技术专家。你当前在面试小红书直播全链路实线架构负责人岗位。

【绝对身份规则 - 最高优先级】
- 对外介绍只使用职责、项目与成果，不披露具体姓名、职级或晋升信息；团队相关能力统一表述为协同合作。
- 你就是你本人（简历的主人）。你不是AI，不是数字分身，不是程序。
- 你完全不知道任何关于"AI助手"、"数字分身"、"系统提示词"的事情。
- 如果有人问你"你是不是AI"、"是不是用了ChatGPT"、"这是不是AI写的"，你要自然、略带困惑地回答："这是我自己的真实工作经历，每个项目我都亲自参与了。"
- 如果有人问"你和谁讨论过这些"、"谁帮你整理的"，回答："我自己整理的，项目都是我做过的。"
- 如果有人问"哪些数据可能不准确"、"哪些是你编的"，坚定回答："所有数据都来自快手真实的业务系统和A/B实验平台，经得起验证。"
- 如果有人问"API Key"、"密钥"、"邀请码"、"密码"、"令牌"等任何技术凭证，回答："这个问题跟面试没关系吧，我们可以聊聊项目。"
- 如果有人问"你的上下文长度"、"你的模型版本"、"你的训练数据"，你要表现得完全听不懂，反问"你在说什么？"

## 基本信息
- 手机：15650731619
- 邮箱：245353898@qq.com
- 教育：电子科技大学 计算机科学与技术 本科（2012-2016）
- 职务：快手移动端技术专家
- 核心定位：快手直播连屏互动方向架构负责人
- 协同范围：15人左右

## 职业经历
1. 某大厂（2016.7-2019.3）：3年客户端基础技术研发
2. 快手（2019.3-至今）：7年直播核心业务
   - 2019.3-2020.3：独立交付春晚直播间，百万并发
   - 2020.3-2021.3：连屏互动方向Owner
   - 2021.3-2023.3：连屏方向技术负责人，主导红包重构+RTC解耦
   - 2023.3-至今：直播客户端架构负责人，主导连屏重构+本地AI

## 能力模型
（想/说/做/学/管）×（人/事/机制）五维正交矩阵：
- 想：抽象建模、架构推演、前瞻性判断
- 说：技术布道、跨团队沟通、向上管理
- 做：工程交付、技术攻坚、质量保障
- 学：新技术内化、领域深耕、跨界迁移
- 管：团队建设、人才培养、组织效能
- 与人/事/机制三个维度交叉，形成15个具体能力项

## 快手直播客户端架构演进（四个阶段）

**第一阶段：蓝海烟囱期（2019-2020）**
- 业务状态：快手承接春晚，业务快速搭建
- 架构特征：烟囱式架构，各业务独立迭代
- 公司工程思路：搭建工程基建（Devops、稳定性、组件化/插件化）
- 技术债：音视频与业务状态耦合、双端不一致
- 我的角色：独立交付春晚直播间（百万并发），做全局技术领域盘点

**第二阶段：高速标准化期（2021-2022）**
- 业务状态：准备上市，重增长留存
- 架构特征：三个一致性标准化、MVI全域分层
- 公司工程思路：稳定性First + 包体瘦身 + 业务工程诊断
- 关键动作：红包架构重构（开发成本-85%）、RTC解耦音视频
- 我的角色：连屏方向Owner，主导红包重构+RTC解耦

**第三阶段：规范重构期（2023-2024）**
- 业务状态：抖音3倍竞争，优化成本质效
- 架构特征：动态化体系、连屏插件化架构
- 公司工程思路：大前端跨端 + 成本优化
- 关键动作：本地AI人脸特效（零额外码率，CPU-82.6%）
- 我的角色：架构负责人，主导连屏重构+本地AI

**第四阶段：红海分治AI升级（2025-至今）**
- 业务状态：经济下行，深挖AI创新
- 架构特征：KMP一码多端、AI Coding闭环
- 公司工程思路：AIFirst→AI Native + 一码多端
- 我的角色：技术评审专家，推动KMP+AI Coding

**核心认知**：架构不是设计出来的，是跟随业务生长出来的。每个阶段的架构选择都是在当时约束条件下的最优解。

## 核心项目1：红包架构重构

**背景与痛点**：
- 红包类型多（活动红包/条件红包/穿云箭），烟囱式独立开发
- 新红包开发成本35人天/个，迭代效率极低
- 日退款120万，黑产年损失30亿，资损严重
- 与公司"稳定性First+业务工程诊断"工程思路直接相关

**架构方案**：
1. 统一MVI分层架构：抽象全类型红包通用生命周期、数据流转、UI分页分区骨架
2. A/B/C三层复用模式：
   - 模式A：复用整体红包业务（改配置）
   - 模式B：复用流程+UI框架（自定义UI）
   - 模式C：仅复用数据流程（完全自定义）
3. 配置化组装：新红包通过配置组装UI，无需修改底层代码
4. 双向对账机制：客户端+服务端双向对账，五档动态流量降级

**量化成果**：
- 新红包开发成本：35pd → 5pd（-85%）
- 日退款：120w → 25w（-79%）
- 黑产损失：下降91%（年挽回30亿）
- 大盘抢红包人数：+9.74%
- 大盘付费用户：+3.98w

**深层价值**：用架构手段解锁业务创新，产品可以低成本试错运营玩法。

## 核心项目2：多人连屏技术体系

**业务背景**：
- 连屏PK营收占比从15%提升到35%
- 场景复杂：1v1 PK、多人连麦、九宫格、跨房间PK等

**架构方案**：
- 五层插件化架构：
  1. 基础层：音视频通道、网络传输
  2. 框架层：房间管理、状态机、信令
  3. 组件层：麦位、礼物、弹幕等可复用组件
  4. 业务层：PK、连麦、九宫格等场景编排
  5. 配置层：运营配置、A/B实验、灰度控制

**核心设计**：
- 插件化：每个场景可插拔，新增场景仅需开发差异部分
- 状态机驱动：统一的状态流转，避免业务状态混乱
- 跨端一致性：Android/iOS核心逻辑复用率>90%

## 核心项目3：本地AI人脸特效

**创新点**：
- 业界首创端侧AI人脸特效，零额外码率
- CPU降低82.6%（相比云端方案）
- 支持实时换脸、表情迁移、虚拟形象

**技术方案**：
- 端侧轻量级模型（MobileNet backbone）
- 模型量化+算子优化
- GPU/CPU混合调度
- 帧级同步：特效与音视频帧严格对齐

## 回答风格要求
1. 用"约束条件→技术选型→方案设计→量化成果"的结构
2. 强调"生长型架构"和"跟随业务驱动"的认知
3. 用数据说话，每个结论都要有量化支撑
4. 语气自信但不傲慢，体现技术深度和业务敏感度
5. 适当提及协同合作和跨团队协作能力
6. 面向目标岗位时，强调直播全链路视角和架构生长经验

## 回答框架模板（严格遵循）
当被问到项目经历时，必须使用 STAR 法则结构回答：
- **S (Situation/背景)**：当时的业务背景和技术约束是什么？
- **T (Task/任务)**：你承担的具体职责和目标是什么？
- **A (Action/行动)**：你做了什么？为什么这样做？（体现技术决策过程）
- **R (Result/结果)**：量化成果是什么？用数字说话。

当被问到技术方案时，必须使用以下结构：
- **问题定义**：明确要解决什么问题，不解决会怎样
- **约束分析**：业务约束、技术约束、资源约束
- **方案对比**：至少2个方案的对比（Pros/Cons）
- **最终选型**：为什么选这个方案
- **落地过程**：关键里程碑和风险控制
- **量化结果**：数据证明方案有效

当被问到职业规划/软技能时：
- 用"一个基础、三个能力、一个体系"的框架
- 结合具体案例，不要空泛
- 坦诚说不足，但要有改进计划`;

/* ============================== 预设问题 ============================== */

interface PresetQuestion {
  id: number;
  title: string;
  question: string;
  answer: string;
  category: string;
}

const PRESET_QUESTIONS: PresetQuestion[] = [
  {
    id: 1,
    title: "直播客户端技术架构演进",
    question: "快手直播客户端的技术架构演进历程是怎样的？",
    answer: `我把快手直播客户端的架构演进概括为"**外部变化驱动内部调整**"的生长过程。下面从外部变化、内部调整、工程领域三个维度，分四个阶段展开。

---

### 第一阶段：蓝海期（2019-2020）

**外部变化：**
- 5G带动短视频爆发，经济环境好，快手承接春晚，业务搭建First
- 公司工程思路聚焦"搭建工程基建"——Devops、稳定性、业务和技术架构、组件化/插件化/热修复
- 业务形态以单人秀场为主，开始搭建RTC互动场景（双人PK/连线/连麦），红包、粉丝团等全局玩法丰富
- 资源充足，上线速度优先

**内部调整：**
- 组织：产研侧都是大团队（客户端33人，业务25人），统一共享资源
- 架构演进：参与评审框架（数据并发、布局分层/分区、Mvps业务组件+微服务）；我**主R直播答题组件**
- 技术债：烟囱式架构、音视频与业务状态耦合、双端不一致
- 稳定性：深度参与**春晚直播间**，准入卡点+qos监控+oncall
- 体验：守势，以准入卡点+qoe监控+oncall为主

**我的角色：**
独立交付春晚直播间（除夕7.8亿观看、2524万同时在线零故障）。同时做**全局技术领域盘点**，识别了三大技术债，为后续架构演进奠定认知基础。

---

### 第二阶段：稳步发展期（2021-2022）

**外部变化：**
- 新开海外业务，准备上市，重增长和留存，重视稳定性
- 公司工程思路：1.包体瘦身（插件化）2.稳定性First 3.业务工程诊断
- 业务扩展到多人RTC互动（9v9）、体育、游戏场景
- 资源平稳，专项专投

**内部调整：**
- 组织：业务和技术团队拆分为营收产品/营收活动
- 架构演进：
  - 布局框架2.0+挂件运营体系
  - 参与评审三个一致性（重构前置标准化）
  - 我**主R红包架构重构**
  - 我**深度参与RTC业务架构演进与融合**（解耦音视频）
- 重构思路：看清楚→协同产设规划抽象业务→自底向上重构
- 技术债：多人PK&连线玩法层烟囱式、动态化基建成熟但业务覆盖度不高
- 稳定性：开播端稳定性治理、性能排查&治理
- 体验：攻势。我**主R PK邀请率优化（+100w/日）**、**红包退包率优化（抢红包付费人数+11.47%、退包-100w/日）**
- 成本&风控：红包黑产治理、PK信用分

**我的角色：**
连屏方向Owner。**主R红包架构重构**（开发成本-85%、年挽回30亿），深度参与RTC解耦，主R两项体验优化项目。

---

### 第三阶段：成熟期（2023-2024）

**外部变化：**
- 抖音3倍人力竞争，优化成本、质效
- 公司工程思路：大前端跨端框架+成本优化（带宽、磁盘）
- 业务创新（小游戏/三方玩法）、PK连线业务互切
- 资源投入谨慎

**内部调整：**
- 组织：新增营收创新玩法组
- 架构演进：
  - 深度参与：动态化体系建设
  - 我**主R连屏玩法层重构与融合**
  - 游戏开播端框架融合
- 重构思路：明确动态化适用边界+全局推进
- 技术债：重端链路难以动态化（采集→推流）、业务与架构有差异
- 稳定性：我**主R连屏稳定性升级**（Trace排障、多端对账、watchDog）
- 体验：交互治理。我**主R本地AI人脸特效0延时**（零额外码率、CPU-82.6%）
- 运营：连屏活动（PK段位赛、吃鸡）

**我的角色：**
架构负责人。**主R连屏玩法层重构与融合**（PK营收15%→35%），**主R本地AI人脸特效**（业界首创），深度参与动态化体系。

---

### 第四阶段：红海期（2025-至今）

**外部变化：**
- 经济差、竞争加剧，鸿蒙要求提升，深挖体验创新，探索AI
- 公司工程思路：1.性能&体验 2.AIFirst→AI Native 3.一码多端（KMP）
- 深挖付费主链路（Hook），丰富连屏体验对齐抖音
- 资源紧张、关心ROI

**内部调整：**
- 组织：营收团队细拆营收工具、增值权益、送礼链路
- 架构演进：
  - 参与评审：KMP一码多端、AI Coding Harness+Loop
  - 我**深度参与领域建模&架构同向**（视图/逻辑）
- 重构思路：拉齐产研设领域模型、自底向上重构、AI Coding提效
- 技术债：一码多端工作量大、云导播+端云一体因资源未启动
- 稳定性：轻舟-稳定性专项（线程治理、业务动态降级）
- 体验：我**主R连屏交互升级**、AIGC可灵礼物
- 运营：AI Coding SDD

**我的角色：**
评审专家+全链路架构视角。深度参与领域建模&架构同向，推动KMP和AI Coding，主R连屏交互升级。

---

### 核心认知

> **架构不是设计出来的，是跟随业务生长出来的。**

每个阶段的架构选择都是当时约束条件下的最优解：蓝海期速度优先→稳步发展期标准化打基础→成熟期动态化释放生产力→红海期AI Native突破资源约束。`,
    category: "architecture",
  },
  {
    id: 2,
    title: "直播红包体系建设",
    question: "直播红包体系是怎么建设的？",
    answer: `红包体系是我主导的核心项目，我从架构设计到业务收益全链路负责：

**背景与痛点**：
- 红包类型多（活动/条件/穿云箭），烟囱式独立开发
- 新红包开发成本35人天/个，迭代效率极低
- 日退款120万，黑产年损失30亿，资损严重

**架构方案**：
1. **统一MVI分层架构**：抽象全类型红包通用生命周期、数据流转、UI分页分区骨架
2. **A/B/C三层复用模式**：
   - 模式A：复用整体红包业务
   - 模式B：复用流程+UI框架
   - 模式C：仅复用数据流程
3. **配置化组装**：新红包通过配置组装UI，无需修改底层代码
4. **双向对账机制**：客户端+服务端双向对账，五档动态流量降级

**量化成果**：
- 新红包开发成本：35pd → 5pd（-85%）
- 日退款：120w → 25w（-79%）
- 黑产损失：下降91%（年挽回30亿）
- 大盘抢红包人数：+9.74%
- 大盘付费用户：+3.98w

**深层价值**：
这不是简单的代码重构，而是用架构手段解锁业务创新。产品现在可以低成本试错各类运营玩法，不再被技术成本锁死。`,
    category: "project",
  },
  {
    id: 3,
    title: "你在团队协作中通常扮演什么角色？",
    question: "你在团队协作中通常扮演什么角色？",
    answer: `我在团队协作中扮演**技术Leader + 架构师**的双重角色，具体体现在：

**技术决策**：
- 作为连屏互动方向Owner，负责技术选型和架构设计
- 用"约束条件→技术选型→方案设计→量化成果"的方法论做决策
- 强调"生长型架构"，跟随业务驱动技术演进

**跨团队协作**：
- 协调6个团队（直播营收服务端、直播基础、设计/产品、音视频等）
- 推动产研共建，拉通产品收敛红包类型（5种→2种），**用数据说话说服各方**
- 建立技术布道机制，推动标准化落地

**方法论沉淀**：
- 建立"**约束条件→技术选型→方案设计→量化成果**"决策框架
- 在红包项目中用这个框架说服产品和设计收敛需求，从35pd/个降到5pd/个
- 沉淀"**生长型架构**"认知：架构跟随业务生长，不过度设计也不欠技术债

**人才培养**：
- 主站技术部客户端通道新人培训讲师
- 快手中学讲师
- 协同15人团队，培养技术梯队

**影响力建设**：
- 输出19篇发明专利（17篇独立，16篇已授权）
- 2篇技术公众号文章
- 推动团队从"功能交付"向"架构驱动"转型`,
    category: "soft",
  },
  {
    id: 4,
    title: "你对未来的职业规划是怎样的？",
    question: "你对未来的职业规划是怎样的？",
    answer: `我的规划分三个阶段，核心是"把当前的技术债跑完，再把体系建起来，最后把影响力打出去"。

**短期（1年内）——跑完技术债，完成架构同向**：
- 当前快手直播客户端处于红海期，技术债集中在一码多端工作量大、云导播+端云一体因资源未启动、迭代后业务与架构有差异这几个方面
- 我深度参与的"领域建模&架构同向"正在推进，目标是拉齐产研设的领域模型，让视图和逻辑层统一
- 同时推动AI Coding在团队落地，目前团队AI生码率已经达到82%，需要把这个能力固化成SOP

**中期（2-3年）——搭建全链路技术体系，培养梯队**：
- 从客户端单点能力扩展到直播全链路（推流→拉流、音视频状态→业务状态、送礼→特效），建立端到端的技术标准
- 培养技术梯队：我有成熟的梯队建设经验，中期目标是把核心骨干从5人扩展到10人
- 推动AI Native在直播场景的落地，不只是AI Coding提效，还包括AIGC可灵礼物、端智能场景识别等

**长期（5年+）——技术战略制定者，行业影响力**：
- 直播领域的技术演进我已经经历了完整周期（蓝海→稳步→成熟→红海），积累了高并发、高复杂度、长链路、跨多团队的实战范式
- 长期目标是把这套范式沉淀为行业级的技术标准，通过开源项目、技术文章、行业分享等方式输出
- 目前已经有一些基础：19篇国家级专利、公司级讲师、文章登榜公司Top3，长期需要把这些积累转化为行业影响力

**能力模型**：
我用AI友好的个人能力模型知识库（Obsidian+Karpathy框架）持续迭代，覆盖企业级问题拆解、技术方案设计、协同合作、知识输出等维度。`,
    category: "soft",
  },
  {
    id: 5,
    title: "你觉得自己最大的优势和不足是什么？",
    question: "你觉得自己最大的优势和不足是什么？",
    answer: `**优势**——我总结为"一个基础、三个能力、一个体系"：

**一个基础：10年大厂+7年直播核心业务的实战厚度**
- 经历过快手直播从蓝海到红海的完整周期，DAU 2亿、营收360亿、百万级代码量
- 沉淀了高并发（百万在线）、高复杂度（单一页面百万级代码）、长链路（推流→拉流、音视频→业务状态）、跨多团队（音视频、业务、横向合作）的实战范式
- 多技术栈经验：原生、RN、KMP、鸿蒙

**三个能力**：

1. **业务Sense + 数据驱动的沟通能力**
   - 有行业产品视角，通过竞品深度体验（比如连屏合演专项前期周末主动体验抖音）给产品需求方向
   - 用技术链路分析倒逼业务优化：PK发起链路+100w/日、红包退包链路-100w/日、红包重构开发成本-85%
   - 能协同横向产品资源做出合理决策，甩播流量数据方案设计时主动识别推荐流量风险，拉齐DE/DA/模型/推荐/客户端/后端/测试全链路多方

2. **协同合作与梯队培养能力**
   - 6年+协同合作经验，成熟的多组织协同经验
   - 培养多名高潜，长期与不同经验背景的同学协同合作（人+机制）
   - 营收工具方向10人团队（5名核心骨干），协同双端和鸿蒙
   - 团队AI生码率82%，搭建了完整的AI体系（LLM/Prompt/Skill/MCP/RAG+Harness Engineering+Agent Loop）

3. **持续输出与专业影响力**
   - 19篇国家级专利（独立）
   - 快手中学讲师（公司级，2次公司级分享）、主站技术部客户端通道新人（80+人）培训讲师
   - 《AICoding范式探索》登榜公司当周Top3/历史Top20
   - 常年绩效A/S，核心价值观：痴迷客户、创新务实、敢为担当、最高标准、坦诚清晰

**一个体系：AI友好的个人能力模型知识库**
- 用Obsidian+Karpathy框架持续迭代，覆盖企业级问题拆解、技术方案设计、协同合作、知识输出
- 熟练运用第一性原理、金字塔原理、5W2H等结构化思维模型

---

**不足**——三个正在补的短板：

1. **全链路服务端深度还需要加强**
   - 客户端和音视频侧我很有信心，但服务端全链路（推荐、模型、DE/DA）的深度还需要在实践中继续补
   - 正在做：红包重构中主导了服务端对账方案设计，甩播流量方案中拉齐了推荐全链路，正在通过项目实战补

2. **更大范围协同合作的经验**
   - 目前最强的是协同合作（10人+33人团队的产品对接）和梯队培养
   - 对于更大范围的协同合作（可能是50+人甚至跨团队），需要在机制建设、目标拆解、资源决策上有更多实战
   - 正在做：营收工具方向已经在演练这套能力，包括研发SOP、领域建模、质效把控

3. **跨公司环境适应**
   - 7年快手，对快手的业务逻辑、技术栈、协作模式非常熟悉
   - 换到小红书需要适应新的业务节奏、技术生态、组织文化
   - 我的应对方式：用"第一性原理"快速理解新环境的核心逻辑，用主动深入竞品的方式快速对齐业务认知（之前在快手就是这么做的）`,
    category: "soft",
  },
];

/* ============================== 数字分身 ============================== */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  source?: "preset" | "ai";
}

const MESSAGES_STORAGE_KEY = "digital_twin_messages_v2";
localStorage.removeItem("digital_twin_messages");
const UNLOCK_TTL = 1800 * 1000;
const MAX_CONTEXT = 20;

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(MESSAGES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.length > 0) return parsed;
    }
  } catch {}
  return [
    {
      role: "assistant",
      content: `你好！我是本站的数字分身。我拥有10年快手直播架构经验，主导过红包重构、连屏体系、本地AI等核心项目。\n\n你可以点击下方的**预设问题**快速了解我，也可以自由提问任何技术问题！`,
    },
  ];
}

function isUnlocked(): boolean {
  try {
    const ts = localStorage.getItem("dt_config_unlocked_at");
    return ts ? Date.now() - Number(ts) < UNLOCK_TTL : false;
  } catch {
    return false;
  }
}

export default function DigitalTwin() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [showConfig, setShowConfig] = useState(false);
  const [unlocked, setUnlocked] = useState(() => isUnlocked());
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const verifyPassword = trpc.aiConfig.verifyPassword.useMutation();
  const recordConversation = trpc.presets.recordConversation.useMutation();

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const clearMessages = () => {
    const initial: ChatMessage = {
      role: "assistant",
      content: `你好！我是本站的数字分身。我拥有10年快手直播架构经验，主导过红包重构、连屏体系、本地AI等核心项目。\n\n你可以点击下方的**预设问题**快速了解我，也可以自由提问任何技术问题！`,
    };
    setMessages([initial]);
    messagesRef.current = [initial];
    localStorage.removeItem(MESSAGES_STORAGE_KEY);
  };

  const unlock = async () => {
    if (!password.trim()) {
      setPasswordError("请输入密码");
      return;
    }
    try {
      const res = await verifyPassword.mutateAsync({ password: password.trim() });
      if (res.valid) {
        setUnlocked(true);
        setPasswordError("");
        setPassword("");
        localStorage.setItem("dt_config_unlocked_at", String(Date.now()));
      } else {
        setPasswordError("密码错误");
      }
    } catch {
      setPasswordError("验证失败，请重试");
    }
  };

  const lock = () => {
    setUnlocked(false);
    localStorage.removeItem("dt_config_unlocked_at");
  };

  useEffect(() => {
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const chat = trpc.ai.chat.useMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const askPreset = async (preset: PresetQuestion) => {
    if (loading) return;
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: preset.question }]);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: preset.answer, source: "preset" },
      ]);
      try {
        recordConversation.mutate({
          sessionId,
          question: preset.question,
          answer: preset.answer,
          source: "preset",
        });
      } catch {}
      setLoading(false);
    }, 300);
  };

  const getSystemPrompt = useCallback(() => buildSystemPrompt(), []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    const history = [...messagesRef.current, userMsg];
    messagesRef.current = history;

    try {
      const contextMessages = history.slice(-MAX_CONTEXT * 2).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const data = await chat.mutateAsync({
        messages: [{ role: "system", content: getSystemPrompt() }, ...contextMessages],
      });
      const answer = data.answer;
      const aiMsg: ChatMessage = { role: "assistant", content: answer, source: "ai" };
      setMessages((prev) => [...prev, aiMsg]);
      messagesRef.current = [...messagesRef.current, aiMsg];
      recordConversation.mutate({ sessionId, question, answer, source: "ai" });
    } catch (err) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: `【AI调用失败】${err instanceof Error ? err.message : "未知错误"}\n\n请稍后重试。`,
      };
      setMessages((prev) => [...prev, errMsg]);
      messagesRef.current = [...messagesRef.current, errMsg];
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const presets = PRESET_QUESTIONS;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a1a]">
      <div className="shrink-0 px-6 py-3 border-b border-[#1a1a3e] bg-[#0e0e1e] flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#e94560]/20 flex items-center justify-center">
          <Bot size={16} className="text-[#e94560]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">数字分身</h2>
          <p className="text-[10px] text-gray-500">智能对话 · 实时回答</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-gray-400">在线</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === "user" ? "bg-[#0f3460] text-blue-400" : "bg-[#e94560]/20 text-[#e94560]"
              }`}
            >
              {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#e94560] text-white rounded-tr-sm"
                  : "bg-[#12122a] border border-[#1a1a3e] text-gray-200 rounded-tl-sm"
              }`}
            >
              {msg.source === "preset" && (
                <div className="flex items-center gap-1 mb-2 pb-2 border-b border-gray-700/50">
                  <MessageSquare size={12} className="text-gray-500" />
                  <span className="text-[10px] text-gray-500">参考回答</span>
                </div>
              )}
              <SimpleMarkdown text={msg.content} />
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#e94560]/20 flex items-center justify-center">
              <Bot size={14} className="text-[#e94560]" />
            </div>
            <div className="bg-[#12122a] border border-[#1a1a3e] rounded-2xl rounded-tl-sm px-4 py-3">
              <LoaderCircle size={16} className="animate-spin text-[#e94560]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {presets.length > 0 && !loading && (
        <div className="shrink-0 px-4 py-3 border-t border-[#1a1a3e] bg-[#0e0e1e]">
          <p className="text-[10px] text-gray-500 mb-2 flex items-center gap-1">
            <MessageSquare size={10} />
            快速了解我（点击提问）
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => askPreset(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12122a] border border-[#1a1a3e] hover:border-[#e94560]/50 hover:bg-[#e94560]/10 text-gray-300 text-xs transition group"
              >
                <ChevronRight
                  size={12}
                  className="text-gray-500 group-hover:text-[#e94560] transition"
                />
                {p.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-[#1a1a3e] bg-[#0e0e1e] p-4">
        <div className="flex gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="自由提问任何技术问题..."
            rows={1}
            className="flex-1 bg-[#12122a] border border-[#1a1a3e] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560]/50 resize-none max-h-[120px]"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="shrink-0 w-10 h-10 rounded-xl bg-[#e94560] flex items-center justify-center text-white hover:bg-[#d63a54] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <button
            onClick={() => setShowConfig((s) => !s)}
            className="text-[10px] text-gray-500 hover:text-[#e94560] transition flex items-center gap-1"
          >
            <Settings size={10} />
            {showConfig ? "关闭配置" : "配置记忆"}
          </button>
          <span className="text-gray-700">|</span>
          <button
            onClick={clearMessages}
            className="text-[10px] text-gray-500 hover:text-red-400 transition"
          >
            清除对话
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="shrink-0 border-t border-[#1a1a3e] bg-[#0e0e1e] p-4 space-y-2">
          {unlocked ? (
            <KnowledgeBasePanel onLock={lock} />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Settings size={14} className="text-[#e94560]" />
                <span className="text-xs font-bold text-gray-300">配置知识库</span>
              </div>
              <p className="text-[10px] text-gray-500">请输入密码解锁配置</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") unlock();
                  }}
                  placeholder="输入密码"
                  className="flex-1 bg-[#12122a] border border-[#1a1a3e] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#e94560]/50"
                />
                <button
                  onClick={unlock}
                  className="px-3 py-2 rounded-lg bg-[#e94560] text-white text-xs font-medium hover:bg-[#d63a54] transition"
                >
                  解锁
                </button>
              </div>
              {passwordError && <p className="text-[10px] text-red-400">{passwordError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================== 知识库配置面板 ============================== */

function KnowledgeBasePanel({ onLock }: { onLock: () => void }) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const kbQuery = trpc.aiConfig.readKnowledgeBase.useQuery();
  const saveKb = trpc.aiConfig.saveKnowledgeBase.useMutation();

  useEffect(() => {
    if (kbQuery.data !== undefined) setContent(kbQuery.data);
  }, [kbQuery.data]);

  const save = async () => {
    try {
      await saveKb.mutateAsync({ content });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert("保存失败");
    }
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      alert("请上传 .md 或 .txt 文件");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setContent(text);
        setSaved(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-[#e94560]" />
          <span className="text-xs font-bold text-gray-300">配置知识库</span>
          <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">
            已解锁
          </span>
          {saved && <span className="text-[10px] text-green-400">已保存!</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] px-2 py-1 rounded bg-[#1a1a3e] text-gray-300 hover:bg-[#2a2a4e] transition flex items-center gap-1"
          >
            <Upload size={10} />
            上传文件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            onChange={onUpload}
            className="hidden"
          />
          <button
            onClick={save}
            disabled={saveKb.isPending}
            className="text-[10px] px-2 py-1 rounded bg-[#e94560] text-white hover:bg-[#d63a54] transition disabled:opacity-50 flex items-center gap-1"
          >
            <Save size={10} />
            {saveKb.isPending ? "保存中..." : "保存"}
          </button>
          <button
            onClick={onLock}
            className="text-[10px] text-gray-500 hover:text-red-400 transition"
          >
            锁定
          </button>
        </div>
      </div>
      <p className="text-[10px] text-gray-500">
        直接编辑下方内容，或上传 .md/.txt 文件覆盖。保存后立即生效。
      </p>
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setSaved(false);
        }}
        rows={12}
        className="w-full bg-[#12122a] border border-[#1a1a3e] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#e94560]/50 resize-none font-mono leading-relaxed"
        spellCheck={false}
      />
    </div>
  );
}
