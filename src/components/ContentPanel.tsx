import React, { Suspense, useEffect, useState } from "react";
import {
  ChartColumn,
  Target,
  Zap,
  CodeXml,
  Shield,
  Briefcase,
  Sparkles,
  Car,
  GraduationCap,
  Award,
  Globe,
  Layers,
  Users,
  GitBranch,
  Rocket,
  TrendingUp,
  ShoppingCart,
  Flame,
  Building2,
  Brain,
  CircuitBoard,
  Smartphone,
  Radio,
  FileCodeCorner,
  Eye,
  ExternalLink,
  Newspaper,
  LoaderCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
// PDF.js 渲染器体积大（~500KB），懒加载：只在打开 PDF 时才下载，不拖慢首屏
const PdfCanvasViewer = React.lazy(() => import("@/components/PdfCanvasViewer"));
import { type ProjectMaterial } from "@/data/content";
import { useNavigation } from "@/navigation";
import { useProjects } from "@/hooks/useProjects";

export function ContentPanel({
  section,
  articlePath,
}: {
  section: string;
  articleId?: string | null;
  articlePath?: string | null;
}) {
  const projects = useProjects("project");
  const research = useProjects("research");
  if (articlePath)
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ArticleViewer mdPath={articlePath} />
      </Suspense>
    );
  if (section === "profile") return <ProfilePage />;
  if (section === "model") return <ModelPage />;
  if (section === "digital-twin") return <DigitalTwinLazy />;
  if (section === "engineering") return <EngineeringPage />;
  const all = [...projects, ...research];
  const project = all.find((p) => p.id === section);
  return project ? <ProjectPage project={project} /> : <ProfilePage />;
}

// 避免循环依赖：DigitalTwin 独立 chunk 懒加载
const DigitalTwinLazy = React.lazy(() => import("./DigitalTwin"));

function LoadingFallback() {
  return (
    <div className="h-full flex items-center justify-center bg-[#0a0a1a]">
      <div className="text-gray-500 text-sm">文档加载中...</div>
    </div>
  );
}

/* ============================== 个人简介 ============================== */

function ProfilePage() {
  const projects = useProjects();
  const pdfOf = (id: string) => projects.find((p) => p.id === id)?.pdfPath ?? "";
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a1a]">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white tracking-wide">个人简介</h1>
          </div>

          <div className="text-center">
            <p className="text-lg text-gray-300 font-medium">
              快手 · 客户端架构师（直播营收方向）
            </p>
            <p className="text-sm text-gray-500 mt-1">15650731619 | 1485857766@qq.com</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {["1994年/31岁", "2019-至今 快手6年+", "19项专利", "团队92% AI生码率"].map(
              (tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-[#e94560]/15 text-[#e94560] text-sm border border-[#e94560]/30"
                >
                  {tag}
                </span>
              ),
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              {
                num: "180亿",
                label: "年流水规模",
                badge: "业务",
                badgeColor: "bg-blue-500/20 text-blue-400",
                icon: <ChartColumn size={16} className="text-blue-400/60" />,
              },
              {
                num: "106%",
                label: "连屏OKR完成率",
                badge: "业务",
                badgeColor: "bg-blue-500/20 text-blue-400",
                icon: <Target size={16} className="text-blue-400/60" />,
              },
              {
                num: "+2.3%",
                label: "减分PK撬动大盘",
                badge: "业务",
                badgeColor: "bg-blue-500/20 text-blue-400",
                icon: <Zap size={16} className="text-blue-400/60" />,
              },
              {
                num: "-85%",
                label: "红包开发成本",
                badge: "质效",
                badgeColor: "bg-green-500/20 text-green-400",
                icon: <CodeXml size={16} className="text-green-400/60" />,
              },
              {
                num: "21个",
                label: "需求零线上故障",
                badge: "质效",
                badgeColor: "bg-green-500/20 text-green-400",
                icon: <Shield size={16} className="text-green-400/60" />,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="text-center p-3 rounded-xl bg-[#12122a] border border-[#1a1a3e]"
              >
                <div className="flex items-center justify-center gap-1 mb-1.5">
                  {s.icon}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s.badgeColor}`}>
                    {s.badge}
                  </span>
                </div>
                <div className="text-lg font-bold text-[#e94560]">{s.num}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-[#12122a] border border-[#1a1a3e]">
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <Briefcase size={14} className="text-[#e94560]" />
              工作经历
            </h3>
            <div className="space-y-2">
              {[
                {
                  company: "快手",
                  period: "2019.04-至今(25岁-至今)",
                  role: "客户端技术专家 / 架构师",
                  highlight: true,
                  icon: <Sparkles size={14} className="text-[#e94560]" />,
                },
                {
                  company: "滴滴出行",
                  period: "2018.02-2019.04(24-25岁)",
                  role: "高级Android开发",
                  highlight: false,
                  icon: <Car size={14} className="text-cyan-400" />,
                },
                {
                  company: "百度 · 作业帮",
                  period: "2016.07-2018.02(22-24岁)",
                  role: "Android开发（直播方向）",
                  highlight: false,
                  icon: <GraduationCap size={14} className="text-blue-400" />,
                },
              ].map((w) => (
                <div key={w.company} className="flex items-center gap-3 py-1.5">
                  <div className="shrink-0 w-5 flex justify-center">{w.icon}</div>
                  <div className="text-sm font-medium text-white w-28 shrink-0">{w.company}</div>
                  <div className="text-xs text-gray-500 w-24 shrink-0">{w.period}</div>
                  <div className="text-xs text-gray-400">{w.role}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-300 mb-3 text-center flex items-center justify-center gap-2">
              <Award size={14} className="text-[#e94560]" />
              个人优势
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                {
                  title: "全局业务视野",
                  icon: <Globe size={16} />,
                  points: ["7年快手直播全周期", "蓝海→红海演进", "趋势驱动技术迭代"],
                },
                {
                  title: "核心业务架构",
                  icon: <Layers size={16} />,
                  points: ["连屏/红包双百亿级", "本地AI通用架构", "跨业务复用范式"],
                },
                {
                  title: "协同合作",
                  icon: <Users size={16} />,
                  points: ["协同10人+团队", "AI Coding体系落地", "生码渗透率92%"],
                },
                {
                  title: "行业技术影响力",
                  icon: <Award size={16} />,
                  points: ["19项国家发明专利", "公司级技术讲师", "技术评审评委"],
                },
              ].map((a) => (
                <div key={a.title} className="p-3 rounded-xl bg-[#12122a] border border-[#1a1a3e]">
                  <div className="text-sm font-bold text-[#e94560] mb-2 flex items-center gap-1.5">
                    {a.icon}
                    {a.title}
                  </div>
                  <div className="space-y-1">
                    {a.points.map((p, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-gray-500 mt-1.5 shrink-0" />
                        <span className="text-[11px] text-gray-400 leading-relaxed">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#12122a] border border-[#1a1a3e]">
            <h3 className="text-sm font-bold text-gray-300 mb-2 text-center flex items-center justify-center gap-2">
              <GitBranch size={14} className="text-[#e94560]" />
              直播工程体系演进
            </h3>
            <p className="text-xs text-gray-500 text-center mb-4">
              快手直播工程体系随外部行业趋势、业务形态与资源诉求的阶段变化，配套调整组织架构，在架构、稳定性、体验等多维度完成从蓝海到红海的全周期迭代演进。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              {[
                {
                  phase: "蓝海期",
                  year: "2019-2020",
                  focus: "5G+短视频爆发",
                  highlight: "搭建基建",
                  icon: <Rocket size={14} />,
                  iconColor: "text-blue-400",
                  color: "border-blue-500/30 bg-blue-500/5",
                  highlightColor: "text-blue-400",
                },
                {
                  phase: "稳步发展期",
                  year: "2021-2022",
                  focus: "海外扩展+上市准备",
                  highlight: "重稳定性",
                  icon: <TrendingUp size={14} />,
                  iconColor: "text-cyan-400",
                  color: "border-cyan-500/30 bg-cyan-500/5",
                  highlightColor: "text-cyan-400",
                },
                {
                  phase: "成熟期",
                  year: "2023-2024",
                  focus: "电商+抖音竞争",
                  highlight: "优化成本质效",
                  icon: <ShoppingCart size={14} />,
                  iconColor: "text-amber-400",
                  color: "border-amber-500/30 bg-amber-500/5",
                  highlightColor: "text-amber-400",
                },
                {
                  phase: "红海期",
                  year: "2025-至今",
                  focus: "深挖体验创新",
                  highlight: "探索AI Native",
                  icon: <Flame size={14} />,
                  iconColor: "text-rose-400",
                  color: "border-rose-500/30 bg-rose-500/5",
                  highlightColor: "text-rose-400",
                },
              ].map((p) => (
                <div
                  key={p.phase}
                  className={`p-3 rounded-lg border ${p.color} flex items-start gap-2`}
                >
                  <span className={`shrink-0 mt-0.5 ${p.iconColor}`}>{p.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-gray-300">{p.phase}</div>
                    <div className="text-[10px] text-gray-500">{p.year}</div>
                    <div className="text-[10px] text-gray-400 mt-1 leading-relaxed">{p.focus}</div>
                    <div className={`text-[11px] font-bold mt-0.5 ${p.highlightColor}`}>
                      {p.highlight}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-300 mb-4 text-center flex items-center justify-center gap-2">
              <Building2 size={14} className="text-[#e94560]" />
              核心项目
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ProfileProjectCard
                title="直播连屏业务架构体系建设"
                period="2022-至今 · 主R"
                tags={["主R", "音视频", "架构融合"]}
                sectionId="lianping"
                pdfPath={pdfOf("lianping")}
                situation="连屏（PK/连线）为直播核心营收业务，占大盘流水50%，覆盖亿级用户与上万大V主播；早期PK与连线烟囱式独立建设，年迭代20+功能，存在复用性差、迭代效率低、跨团队链路长、大V场景稳定性风险高等痛点。"
                challenge={
                  "1. 业务复杂度高：上下游链路长、跨层通信多、音视频状态复杂（3个角色、6个团队、2路采集/6路输出）\n2. 迭代速度快：业务形态丰富，流程和UI多变，扩展性和复用性要求高\n3. 稳定性要求高：流水高、大V多，线上稳定性和排障速度要求高"
                }
                action={
                  "1. 分层架构重构：抽象底层多人互动框架，统一收敛房间管理、音视频渲染能力，解耦音视频与业务逻辑；业务层落地「流程机制-模式-子功能-子元素」四级复用模型，实现子功能跨业务可插拔\n2. UI体系标准化：拉通产设制定UI分层规范，搭建窗格层/玩法层/临时状态层三级UI管理框架，通过分区互斥、优先级排队机制，从根源解决多业务UI位置冲突问题\n3. 稳定性与协作体系建设：落地全链路Trace排障体系、S级大V保障SOP、性能准出规范；输出标准化跨团队协作流程，支撑夏奥等外部业务快速接入连屏能力"
                }
                result={
                  "1. 业务收益：连屏流水OKR完成率106%，同比增长12%；付费用户达112万，付费率同比提升30%；首创减分PK玩法，撬动大盘总流水提升2.3%\n2. 技术收益：新玩法开发成本从25pd降至8pd，同类玩法迁移成本低至1pd；多团队问题定位耗时缩短60%\n3. 稳定性：快速切玩法无UI问题从7.8万/日降至475/日，全年21个核心需求零线上故障"
                }
              />
              <ProfileProjectCard
                title="直播红包业务全链路架构重构"
                period="2021-2022 · 主R"
                tags={["主R", "商业化", "资损治理"]}
                sectionId="hongbao"
                pdfPath={pdfOf("hongbao")}
                situation="直播红包为日千万级流水的营收核心业务，覆盖亿级用户；历史5类红包烟囱式发展，逻辑重复、UI混乱、无统一监控体系，存在迭代效率低、退款率高、黑产套利等核心问题。"
                challenge={
                  "1. 五种红包烟囱式发展，各套独立实现，互不复用\n2. 缺乏业务监控体系，资损严重\n3. 运营迭代效率极低，产品创新能力被技术成本锁死"
                }
                action={
                  "1. 业务本质收敛：拉通产品侧将5类差异红包，抽象为「秒杀类/开奖类」2类通用业务模型，统一核心流程与数据标准\n2. 分层架构设计：搭建「流程控制层-UI框架层-通用组件层-业务层」四级架构，支持分层复用；落地UI分页分区配置化能力，实现组件化组装与远端样式动态下发\n3. 全链路配套体系建设：搭建QoE/QoS分级监控体系，实现问题快速归因；落地延迟拆包、余额前置校验等体验优化；联合风控搭建发红包分级限额规则，治理黑产大额套利问题"
                }
                result={
                  "1. 业务收益：抢红包且付费人数提升11.47%；大盘退款金额从120万/日降至25万/日，降幅86%；粉丝团红包黑产规模下降91%，年抵御黑产规模约30亿\n2. 技术收益：新红包开发成本降低85%（25pd→4pd），新场景接入成本降低70%；双端包体各瘦身1.3M（精简3万行冗余代码），业务维护成本降低60%"
                }
              />
              <ProfileProjectCard
                title="直播本地AI通用架构建设"
                period="2024-2025 · 主R · 红海期"
                tags={["主R", "端智能", "AI Native"]}
                sectionId="ai"
                pdfPath={pdfOf("ai")}
                situation="互动跟脸特效占互动礼物流水24%，原有合流方案端到端延迟达5秒，本地跟脸仅支持5个关键点、5帧/秒，精度差、体验弱；音视频通道带宽受限，无法承载高精度人脸数据传输。"
                challenge={
                  "1. 合流延迟高（5s+）vs 本地精准度差，两个方案体验都不好\n2. AAC通道数据限制256B，SEI通道影响带宽\n3. 9人PK场景每帧3.6KB数据量，高频输入33ms/次+，时序性要求严格"
                }
                action={
                  "1. 技术选型决策：横向对比RTC+AAC、RTC+SEI、本地AI识别三套方案，结合机型分布与体验收益，最终选型端侧轻量本地AI识别方案，平衡性能与体验\n2. 通用分层架构设计：设计「业务适配层-流程控制层-模型识别层-输入适配层」四层架构，兼容多角色、多场景、多路音视频输入，标准化输入输出协议，支持多模型扩展注入\n3. 性能深度优化：落地生产消费者帧调度模型、YUV内存直访与分辨率下采样、机型分级动态策略，将性能增量控制在合理范围；同步落地主播端SEI压缩传输方案，解决多人PK场景对端人脸数据同步问题"
                }
                result={
                  "1. 业务收益：跟脸特效响应速度从200ms优化至25ms，提升8倍；人脸关键点精度从5个提升至101个，提升20倍；赋能实时跨屏互动特效，端到端延迟从5秒降至0\n2. 技术收益：搭建直播端侧通用AI架构，支持多业务、多模型快速接入，为后续人体识别、手势识别等AI能力预留完整技术底座"
                }
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-300 mb-3 text-center flex items-center justify-center gap-2">
              <Brain size={14} className="text-[#e94560]" />
              核心技能
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  dim: "业务架构",
                  icon: <CircuitBoard size={16} />,
                  points: [
                    "领域建模与烟囱重构",
                    "分层复用架构设计",
                    "高并发稳定性治理",
                    "全链路监控与风控",
                    "资损治理体系搭建",
                  ],
                },
                {
                  dim: "协同合作",
                  icon: <Users size={16} />,
                  points: [
                    "跨团队协同合作",
                    "人才梯队建设",
                    "技术评审SOP机制",
                    "跨多部门协同推进",
                    "目标拆解与落地管控",
                  ],
                },
                {
                  dim: "客户端工程",
                  icon: <Smartphone size={16} />,
                  points: [
                    "Android原生体系架构",
                    "组件化/插件化落地",
                    "包体与性能优化",
                    "DevOps全流程管控",
                    "鸿蒙/KMP跨端演进",
                  ],
                },
                {
                  dim: "音视频技术",
                  icon: <Radio size={16} />,
                  points: [
                    "直播推拉流Pipeline",
                    "音视频软硬编解码",
                    "AAC/SEI信令传输",
                    "RTC多人互动架构",
                    "YUV纹理渲染优化",
                  ],
                },
                {
                  dim: "前沿技术",
                  icon: <Sparkles size={16} />,
                  points: [
                    "端侧AI通用架构设计",
                    "AI Coding体系落地",
                    "低代码运营平台搭建",
                    "端智能方案评审",
                    "模型量化与算子优化",
                  ],
                },
                {
                  dim: "技术基础",
                  icon: <FileCodeCorner size={16} />,
                  points: [
                    "Java并发与JVM内存模型",
                    "Android Framework原理",
                    "操作系统与网络协议",
                    "线程调度深度优化",
                    "复杂问题系统排查",
                  ],
                },
              ].map((s) => (
                <div key={s.dim} className="p-3 rounded-xl bg-[#12122a] border border-[#1a1a3e]">
                  <div className="text-sm font-bold text-[#e94560] mb-2 flex items-center gap-1.5">
                    {s.icon}
                    {s.dim}
                  </div>
                  <div className="space-y-1">
                    {s.points.map((p, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-gray-500 mt-1.5 shrink-0" />
                        <span className="text-[11px] text-gray-400 leading-relaxed">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== 项目卡片（STAR） ============================== */

function ProfileProjectCard({
  title,
  period,
  tags,
  sectionId,
  pdfPath,
  situation,
  challenge,
  action,
  result,
}: {
  title: string;
  period: string;
  tags: string[];
  sectionId: string;
  pdfPath: string;
  situation: string;
  challenge: string;
  action: string;
  result: string;
}) {
  const { navigateTo } = useNavigation();
  return (
    <div className="rounded-xl bg-[#12122a] border border-[#1a1a3e] overflow-hidden">
      <div className="px-5 py-3 bg-gradient-to-r from-[#e94560]/20 to-transparent border-b border-[#1a1a3e]">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">{title}</h3>
              <span className="text-xs text-gray-500">{period}</span>
            </div>
            <div className="flex gap-1.5 mt-1">
              {tags.map((t) => (
                <span key={t} className="px-1.5 py-0.5 rounded bg-[#e94560]/15 text-[#e94560] text-[10px]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-2.5">
          <button
            onClick={() => navigateTo(sectionId)}
            className="px-3 py-1.5 rounded-lg bg-[#e94560] text-white text-xs font-medium hover:bg-[#d63d56] transition flex items-center gap-1"
          >
            <Eye size={12} />
            查看原始材料
          </button>
          {pdfPath && (
            <a
              href={pdfPath}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#1a1a3e] text-gray-400 text-xs font-medium hover:bg-[#2a2a4e] hover:text-gray-200 transition flex items-center gap-1 border border-[#1a1a3e]"
              title="在新标签页打开PDF"
            >
              <ExternalLink size={12} />
              打开PDF
            </a>
          )}
        </div>
      </div>
      <div className="px-5 py-3 space-y-2.5">
        <StarRow label="S" labelColor="bg-blue-500" title="背景" content={situation} />
        <StarRow label="T" labelColor="bg-sky-400" title="挑战" content={challenge} />
        <StarRow label="A" labelColor="bg-purple-500" title="方案与行动" content={action} />
        <StarRow label="R" labelColor="bg-green-500" title="结果" content={result} highlight highlightNumbers />
      </div>
    </div>
  );
}

function NumberHighlight({ text }: { text: string }) {
  const parts = text.split(
    /([+\-]?\d+(?:\.\d+)?(?:%|亿|万|个|人|pd|ms|秒|倍|\s*\/[日万pd])?|→\s*[+\-]?\d+(?:\.\d+)?(?:%|亿|万|个|人|pd|ms|秒|倍|\s*\/[日万pd])?)/g,
  );
  return (
    <>
      {parts.map((part, i) =>
        /^[+\-]?\d+(?:\.\d+)?(?:%|亿|万|个|人|pd|ms|秒|倍|\s*\/[日万pd])?$/.test(part) ? (
          <span key={i} className="text-[#e94560] font-bold">
            {part}
          </span>
        ) : /^→/.test(part) ? (
          <span key={i}>
            <span className="text-gray-500 mx-0.5">→</span>
            <span className="text-[#e94560] font-bold">{part.replace(/^→\s*/, "")}</span>
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function StarRow({
  label,
  labelColor,
  title,
  content,
  highlight,
  highlightNumbers,
}: {
  label: string;
  labelColor: string;
  title: string;
  content: string;
  highlight?: boolean;
  highlightNumbers?: boolean;
}) {
  const lines = content.split(/\n|\\n/).filter(Boolean);
  return (
    <div className="flex gap-2">
      <div className="shrink-0 flex flex-col items-center">
        <span
          className={`w-5 h-5 rounded-full ${labelColor} text-white text-[10px] font-bold flex items-center justify-center`}
        >
          {label}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-semibold ${highlight ? "text-green-400" : "text-gray-400"}`}>
          {title}
        </span>
        <div className="text-xs text-gray-300 leading-relaxed mt-0.5">
          {lines.map((line, i) => (
            <div key={i} className={i > 0 ? "mt-1" : ""}>
              {highlightNumbers ? <NumberHighlight text={line} /> : line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================== 能力模型 ============================== */

function ModelPage() {
  const matrix = [
    {
      dim: "想",
      people: "抽象建模",
      thing: "架构推演",
      mechanism: "前瞻性判断",
      color: "from-blue-600 to-indigo-600",
    },
    {
      dim: "说",
      people: "技术布道",
      thing: "跨团队沟通",
      mechanism: "向上管理",
      color: "from-purple-600 to-pink-600",
    },
    {
      dim: "做",
      people: "工程交付",
      thing: "技术攻坚",
      mechanism: "质量保障",
      color: "from-cyan-600 to-blue-600",
    },
    {
      dim: "学",
      people: "新技术内化",
      thing: "领域深耕",
      mechanism: "跨界迁移",
      color: "from-violet-600 to-purple-600",
    },
    {
      dim: "管",
      people: "团队建设",
      thing: "人才培养",
      mechanism: "组织效能",
      color: "from-fuchsia-600 to-pink-600",
    },
  ];
  const cases = [
    { cell: "想 × 事", project: "红包重构：抽象统一生命周期+UI骨架，架构推演从35pd→5pd" },
    { cell: "说 × 机制", project: "建立评审SOP+成长辅导体系，推动标准化落地" },
    { cell: "做 × 人", project: "连屏合演专项：周末主动体验竞品，梳理核心链路同步全团队" },
    { cell: "学 × 事", project: "全局技术领域盘点（蓝海期）→ 建立Karpathy范式知识库" },
    { cell: "管 × 人", project: "连屏人才梯队1人→5人" },
  ];

  return (
    <div className="p-8 max-w-4xl h-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
        <Brain size={20} className="text-[#e94560]" />
        能力模型
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        （想/说/做/学/管）×（人/事/机制）五维正交矩阵 — 覆盖管理者全部15个能力维度
      </p>

      <div className="rounded-xl border border-[#1a1a3e] overflow-hidden mb-8">
        <div className="grid grid-cols-4 bg-[#0e0e1e]">
          <div className="px-4 py-3 text-center text-xs font-bold text-gray-500 border-b border-r border-[#1a1a3e]">
            维度 \ 范畴
          </div>
          <div className="px-4 py-3 text-center text-xs font-bold text-blue-400 border-b border-r border-[#1a1a3e] bg-blue-500/5">
            人
          </div>
          <div className="px-4 py-3 text-center text-xs font-bold text-purple-400 border-b border-r border-[#1a1a3e] bg-purple-500/5">
            事
          </div>
          <div className="px-4 py-3 text-center text-xs font-bold text-pink-400 border-b border-[#1a1a3e] bg-pink-500/5">
            机制
          </div>
        </div>
        {matrix.map((row, ri) => (
          <div key={row.dim} className="grid grid-cols-4">
            <div
              className={`px-4 py-4 flex items-center justify-center border-r border-[#1a1a3e] ${ri < matrix.length - 1 ? "border-b" : ""} bg-gradient-to-r ${row.color} bg-opacity-10`}
            >
              <span className="text-sm font-bold text-white">{row.dim}</span>
            </div>
            <div
              className={`px-4 py-4 flex items-center justify-center border-r border-[#1a1a3e] ${ri < matrix.length - 1 ? "border-b" : ""} bg-blue-500/5 hover:bg-blue-500/10 transition`}
            >
              <span className="text-xs text-gray-300 text-center">{row.people}</span>
            </div>
            <div
              className={`px-4 py-4 flex items-center justify-center border-r border-[#1a1a3e] ${ri < matrix.length - 1 ? "border-b" : ""} bg-purple-500/5 hover:bg-purple-500/10 transition`}
            >
              <span className="text-xs text-gray-300 text-center">{row.thing}</span>
            </div>
            <div
              className={`px-4 py-4 flex items-center justify-center ${ri < matrix.length - 1 ? "border-b" : ""} border-[#1a1a3e] bg-pink-500/5 hover:bg-pink-500/10 transition`}
            >
              <span className="text-xs text-gray-300 text-center">{row.mechanism}</span>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold mb-3 text-gray-300 flex items-center gap-1.5">
        <Zap size={14} className="text-[#e94560]" />
        交叉实践案例
      </h3>
      <div className="space-y-2 mb-8">
        {cases.map((c) => (
          <div
            key={c.cell}
            className="flex items-start gap-3 p-3 rounded-lg bg-[#12122a] border border-[#1a1a3e]"
          >
            <span className="shrink-0 px-2 py-0.5 rounded bg-[#e94560]/15 text-[#e94560] text-[10px] font-medium">
              {c.cell}
            </span>
            <span className="text-xs text-gray-400">{c.project}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== 项目详情页（PDF） ============================== */

/** 带下载进度条的 PDF 查看器：先 fetch 显示进度，完成后交给浏览器渲染 */
function PdfViewer({ url }: { url: string }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProgress(null);
    setLoadedBytes(0);
    setTotalBytes(0);
    setPdfData(null);
    setError(false);

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const total = Number(res.headers.get("content-length") || 0);
        if (!res.body) {
          // 无流式接口：直接整体读取
          const buf = await res.arrayBuffer();
          if (cancelled) return;
          setPdfData(buf);
          return;
        }
        if (total > 0) setTotalBytes(total);
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (!cancelled) {
              setLoadedBytes(received);
              if (total > 0) setProgress(Math.min(100, Math.round((received / total) * 100)));
            }
          }
        }
        if (cancelled) return;
        const merged = new Uint8Array(received);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        setPdfData(merged.buffer);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  const fmt = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

  if (error) {
    return (
      <div className="w-full h-full rounded-lg border border-[#1a1a3e] bg-[#12122a] flex items-center justify-center">
        <span className="text-gray-500 text-sm">PDF 加载失败，请刷新重试</span>
      </div>
    );
  }

  if (!pdfData) {
    const pct = progress ?? (totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : null);
    return (
      <div className="w-full h-full rounded-lg border border-[#1a1a3e] bg-[#12122a] flex flex-col items-center justify-center gap-3">
        <LoaderCircle size={20} className="text-[#e94560] animate-spin" />
        <span className="text-gray-400 text-xs">
          正在下载 PDF{totalBytes > 0 ? `（${fmt(loadedBytes)} / ${fmt(totalBytes)}）` : loadedBytes > 0 ? `（已下载 ${fmt(loadedBytes)}）` : "..."}
        </span>
        <div className="w-64 h-1.5 rounded-full bg-[#1a1a3e] overflow-hidden">
          {pct !== null ? (
            <div className="h-full bg-[#e94560] rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
          ) : (
            <div className="h-full w-1/3 bg-[#e94560] rounded-full animate-pulse" />
          )}
        </div>
        {pct !== null && <span className="text-[10px] text-gray-500">{pct}%</span>}
      </div>
    );
  }

  // 下载完成：用 PDF.js 渲染成 canvas（跨端兼容，解决手机端 <object> 白屏问题）
  return (
    <div className="w-full h-full rounded-lg border border-[#1a1a3e] overflow-hidden bg-[#12122a]">
      <Suspense
        fallback={
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <LoaderCircle size={20} className="text-[#e94560] animate-spin" />
            <span className="text-gray-400 text-xs">正在加载渲染器...</span>
          </div>
        }
      >
        <PdfCanvasViewer data={pdfData} />
      </Suspense>
    </div>
  );
}

function ProjectPage({ project }: { project: ProjectMaterial }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-3 border-b border-[#1a1a3e] bg-[#0e0e1e] flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold flex items-center gap-2">
              <FileCodeCorner size={16} className="text-[#e94560]" />
              {project.label}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {project.tags.map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded-full bg-[#0f3460]/50 text-blue-400 text-[10px] border border-[#1a1a3e]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">{project.desc}</p>
        </div>
      </div>

      {project.imagePath && (
        <div className="shrink-0 mx-6 mt-4 rounded-lg border border-[#1a1a3e] overflow-hidden bg-[#12122a]">
          <div className="px-3 py-1.5 bg-[#0e0e1e] border-b border-[#1a1a3e] flex items-center gap-2">
            <Eye size={12} className="text-gray-500" />
            <span className="text-[10px] text-gray-400">项目技术方案截图</span>
          </div>
          <div className="p-3">
            <img
              src={project.imagePath}
              alt={project.label}
              className="w-full rounded select-none cursor-zoom-in"
              style={{ maxHeight: "240px", objectFit: "contain" }}
              draggable={false}
            />
          </div>
        </div>
      )}

      <div className="flex-1 p-4 min-h-0">
        {project.pdfPath ? (
          <PdfViewer url={project.pdfPath} />
        ) : (
          <div className="w-full h-full rounded-lg border border-[#1a1a3e] bg-[#12122a] flex items-center justify-center">
            <div className="text-gray-500 text-sm">
              {project.mdPath ? "该文档为 Markdown 格式，请在上方标签中查看" : "暂无 PDF 材料，可在后台上传"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== 直播工程体系演进 ============================== */

/** 角色标签高亮：【主R】【深度参与】【参与评审】【参与】 */
function roleHighlight(text: string): string {
  return text
    .replace(
      /【主R】/g,
      '<span class="inline-block px-1 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold mr-0.5">主R</span>',
    )
    .replace(
      /【深度参与】/g,
      '<span class="inline-block px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[10px] font-bold mr-0.5">深度参与</span>',
    )
    .replace(
      /【参与评审】/g,
      '<span class="inline-block px-1 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-bold mr-0.5">参与评审</span>',
    )
    .replace(
      /【参与】/g,
      '<span class="inline-block px-1 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-bold mr-0.5">参与</span>',
    );
}

interface EvoRow {
  category: string;
  highlight?: boolean;
  items: string[];
}

function EngineeringPage() {
  const phases = [
    "蓝海期(2019-2020)",
    "稳步发展期(2021-2022)",
    "成熟期(2023-2024)",
    "红海期(2025-至今)",
  ];

  const externalRows: EvoRow[] = [
    {
      category: "行业 & 公司",
      items: [
        "5G→短视频 + 经济环境好，快手承接春晚，业务搭建First",
        "新开海外业务，准备上市，重增长和留存，重视稳定性",
        "开电商业务。抖音发展迅速(3倍人力)，优化成本、质效",
        "经济差、竞争加剧，工信部鸿蒙要求提升，深挖体验、创新，探索AI",
      ],
    },
    {
      category: "公司工程思路",
      highlight: true,
      items: [
        "搭建工程基建（Devops、稳定性、业务和技术架构、组件化/插件化/热修复）",
        "1. 包体瘦身(插件化)\n2. 稳定性First\n3. 业务工程诊断",
        "1. 大前端、跨端框架\n2. 成本优化（带宽、磁盘等）",
        "1. 性能&体验优化\n2. AIFirst→AI Native\n3. 一码多端(KMP)",
      ],
    },
    {
      category: "直播业务形态",
      items: [
        "单人秀场为主，开始搭建RTC互动场景。全局玩法丰富，红包、粉丝团、礼物面板",
        "多人RTC互动(9v9)。扩展体育、游戏场景，活动类常态化",
        "创新：小游戏和三方玩法。PK、连线业务互切。规范：布局、运营、流程",
        "深挖付费主链路(Hook)，提升转化。丰富连屏体验(对齐抖音)",
      ],
    },
    {
      category: "资源诉求",
      items: [
        "资源充足，保证稳定性下，上线速度优先",
        "资源平稳，专项专投",
        "资源投入谨慎",
        "资源紧张、关心ROI",
      ],
    },
  ];

  const internalRows: EvoRow[] = [
    {
      category: "组织团队",
      items: [
        "产研侧都是大团队(客户端33人，业务25人)，统一共享资源",
        "业务和技术团队拆分为营收产品/营收活动，业务各自打磨体系",
        "新增营收创新玩法组",
        "营收团队细拆营收工具、增值权益、送礼链路",
      ],
    },
    {
      category: "架构演进",
      items: [
        "【参与评审】框架：数据并发、间内布局(分层/分区)、Mvps+微服务\n【深度参与】直播答题组件",
        "【主R】红包架构重构\n【深度参与】RTC业务架构演进与融合(解耦音视频)\n布局框架2.0+挂件运营体系、三个一致性标准化",
        "【主R】连屏玩法层重构与融合\n【参与】动态化体系建设、游戏开播端框架融合",
        "【深度参与】领域建模&架构同向(视图/逻辑)\n【参与评审】KMP一码多端、AI Coding Harness+Loop",
      ],
    },
    {
      category: "重构落地思路",
      items: [
        "全局技术领域盘点",
        "看清楚→协同产设规划抽象业务→自底向上重构",
        "明确动态化适用边界+全局推进",
        "拉齐产研设领域模型、自底向上重构、AI Coding提效",
      ],
    },
    {
      category: "架构技术债",
      items: [
        "烟囱式架构、音视频与业务状态耦合、双端不一致",
        "PK&连线玩法层烟囱式、动态化基建成熟但业务覆盖度不高",
        "重端链路难以动态化、迭代后业务与架构有差异",
        "一码多端工作量大、云导播+端云一体因资源未启动",
      ],
    },
    {
      category: "稳定性",
      items: [
        "【深度参与】春晚直播间\n监控：准入卡点+qos+oncall",
        "【参与评审】开播端稳定性治理、性能排查&治理、业务省电模式",
        "【主R】连屏稳定性升级：Trace排障、多端对账、watchDog",
        "轻舟-稳定性专项：线程治理、业务动态降级、dryRun监控",
      ],
    },
    {
      category: "体验",
      items: [
        "守：准入卡点+qoe+oncall",
        "攻：【主R】PK邀请率+100w/日、红包退包率-100w/日",
        "交互治理+【主R】本地AI人脸特效0延时",
        "【主R】连屏交互升级、AIGC可灵礼物、端智能",
      ],
    },
    {
      category: "成本 & 风控",
      items: [
        "音视频做工(动态码率/帧率)、内容风控审核",
        "资源预载、礼物素材治理、红包黑产治理、PK信用分",
        "资源削峰&上线SOP",
        "特效生产端AI工作流重构",
      ],
    },
    {
      category: "运营 & 质效",
      items: [
        "多变且活动类为主(活动红包)",
        "红包UI骨架+皮肤运营编辑平台、礼物素材上线平台",
        "连屏活动(PK段位赛、吃鸡)",
        "【参与评审】AI Coding SDD",
      ],
    },
  ];

  const phaseColors = [
    "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "bg-rose-500/10 text-rose-400 border-rose-500/20",
  ];

  const renderTable = (rows: EvoRow[]) => (
    <div className="overflow-x-auto">
      <div className="rounded-lg border border-[#1a1a3e] overflow-hidden min-w-[600px]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#0f3460]/50">
              <th className="px-3 py-2 text-left text-gray-300 font-semibold w-28 shrink-0">
                维度
              </th>
              {phases.map((p, i) => (
                <th
                  key={p}
                  className={`px-3 py-2 text-left font-semibold ${phaseColors[i].split(" ")[1]}`}
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a3e]">
            {rows.map((row) => (
              <tr key={row.category} className="hover:bg-[#1a1a3e]/30">
                <td
                  className={`px-3 py-2.5 font-medium shrink-0 ${row.highlight ? "text-[#e94560]" : "text-gray-300"}`}
                >
                  {row.category}
                </td>
                {row.items.map((item, i) => (
                  <td
                    key={i}
                    className="px-3 py-2.5 text-gray-400 leading-relaxed whitespace-pre-line"
                    dangerouslySetInnerHTML={{ __html: roleHighlight(item) }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a1a]">
      <div className="shrink-0 px-6 py-3 border-b border-[#1a1a3e] bg-[#0e0e1e]">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold flex items-center gap-2">
            <GitBranch size={16} className="text-[#e94560]" />
            直播工程体系演进
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {["架构演进", "工程体系", "全链路"].map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 rounded-full bg-[#0f3460]/50 text-blue-400 text-[10px] border border-[#1a1a3e]"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <p className="text-gray-500 text-xs mt-0.5">
          6年完整周期 · 外部变化驱动内部调整 · 4阶段×8维度演进全景
        </p>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        <div className="px-4 py-3 rounded-lg bg-[#0f3460]/30 border border-[#1a1a3e] mb-4">
          <p className="text-xs text-gray-300 leading-relaxed">
            快手直播工程体系随外部行业趋势、业务形态与资源诉求的阶段变化，配套调整组织架构，在架构、稳定性、体验等多维度完成从蓝海到红海的全周期迭代演进。
          </p>
        </div>

        <div className="overflow-x-auto mb-4">
          <div className="flex gap-2 min-w-[600px]">
            {phases.map((p, i) => (
              <div
                key={p}
                className={`flex-1 px-3 py-2 rounded-lg border text-center text-xs font-bold ${phaseColors[i]}`}
              >
                {p}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Globe size={14} className="text-[#e94560]" />
            一、外部变化
          </h3>
          {renderTable(externalRows)}
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Building2 size={14} className="text-[#e94560]" />
            二、内部调整
          </h3>
          {renderTable(internalRows)}
        </div>

        <div className="px-4 py-3 rounded-lg bg-[#e94560]/5 border border-[#e94560]/20 mb-4">
          <p className="text-xs text-gray-300 flex items-start gap-1.5">
            <Sparkles size={12} className="text-[#e94560] shrink-0 mt-0.5" />
            <span>
              <span className="text-[#e94560] font-bold">核心认知：</span>
              架构不是设计出来的，是跟随业务生长出来的。每个阶段的架构选择都是在当时约束条件下的最优解。
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================== 技术文章查看器 ============================== */

interface TocItem {
  level: number;
  text: string;
  id: string;
}

function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50);
}

function buildToc(md: string): TocItem[] {
  const lines = md.split("\n");
  const toc: TocItem[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim();
      toc.push({ level, text, id: slugifyHeading(text) });
    }
  }
  return toc;
}

const articleMdComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => {
    const id = slugifyHeading(children?.toString() || "");
    return (
      <h1
        id={id}
        className="text-2xl font-bold text-white mt-8 mb-4 pb-2 border-b border-[#1a1a3e] scroll-mt-4"
      >
        {children}
      </h1>
    );
  },
  h2: ({ children }: { children?: React.ReactNode }) => {
    const id = slugifyHeading(children?.toString() || "");
    return (
      <h2
        id={id}
        className="text-xl font-semibold text-white mt-6 mb-3 flex items-center gap-2 scroll-mt-4"
      >
        <span className="w-1 h-5 bg-[#e94560] rounded-full" />
        {children}
      </h2>
    );
  },
  h3: ({ children }: { children?: React.ReactNode }) => {
    const id = slugifyHeading(children?.toString() || "");
    return (
      <h3 id={id} className="text-lg font-medium text-gray-200 mt-4 mb-2 scroll-mt-4">
        {children}
      </h3>
    );
  },
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-gray-300 text-sm leading-relaxed mb-3">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="text-gray-300 text-sm space-y-1 mb-3 ml-4">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="text-gray-300 text-sm space-y-1 mb-3 ml-4 list-decimal">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="flex items-start gap-2">
      <span className="w-1 h-1 rounded-full bg-[#e94560] mt-2 shrink-0" />
      <span>{children}</span>
    </li>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border border-[#1a1a3e] rounded-lg">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-[#0f3460]/50">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-[#1a1a3e]">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="hover:bg-[#1a1a3e]/50 transition-colors">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-300 uppercase">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-2 text-gray-400">{children}</td>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    className ? (
      <pre className="bg-[#0e0e1e] border border-[#1a1a3e] rounded-lg p-4 overflow-x-auto mb-4">
        <code className={className}>{children}</code>
      </pre>
    ) : (
      <code className="px-1.5 py-0.5 bg-[#1a1a3e] rounded text-[#e94560] text-xs">{children}</code>
    ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-[#e94560] pl-4 py-1 my-4 bg-[#e94560]/5 rounded-r-lg">
      {children}
    </blockquote>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="text-white font-semibold">{children}</strong>
  ),
};

function ArticleViewer({ mdPath }: { mdPath: string }) {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [toc, setToc] = useState<TocItem[]>([]);
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  // mdPath 形如 /api/articles/file?p=<相对路径>，从中推出文章所在目录用于解析相对图片
  const relPath = (() => {
    try {
      return new URLSearchParams(mdPath.split("?")[1] || "").get("p") || "";
    } catch {
      return "";
    }
  })();
  const articleDir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/") + 1) : "";

  /** 相对路径拼接（处理 ./ 与 ../ 引用） */
  const resolveImageSrc = (src?: string) => {
    if (!src) return src;
    if (src.startsWith("http") || src.startsWith("data:")) return src;
    const cleaned = src.replace(/^\.\//, "");
    const parts = (articleDir + cleaned).split("/").filter(Boolean);
    const stack: string[] = [];
    for (const part of parts) {
      if (part === "..") stack.pop();
      else if (part !== ".") stack.push(part);
    }
    return `/api/articles/file?p=${encodeURIComponent(stack.join("/"))}`;
  };

  useEffect(() => {
    setLoading(true);
    fetch(mdPath)
      .then((r) => r.text())
      .then((text) => {
        setContent(text);
        const m = text.match(/^#\s+(.+)$/m);
        setTitle(m ? m[1].trim() : "文章");
        setToc(buildToc(text));
        setLoading(false);
      })
      .catch(() => {
        setContent("# 加载失败");
        setLoading(false);
      });
  }, [mdPath]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading)
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a1a]">
        <div className="text-gray-500 text-sm">加载文章中...</div>
      </div>
    );

  return (
    <div className="h-full flex bg-[#0a0a1a]">
      {toc.length > 0 && (
        <div
          className={`shrink-0 border-r border-[#1a1a3e] bg-[#0e0e1e] overflow-hidden hidden md:flex flex-col transition-all duration-300 ${tocCollapsed ? "w-8" : "w-44"}`}
        >
          <div className="flex items-center justify-between px-2 py-2 border-b border-[#1a1a3e]">
            {!tocCollapsed && (
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">目录</p>
            )}
            <button
              onClick={() => setTocCollapsed((c) => !c)}
              className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-[#1a1a3e] transition"
              title={tocCollapsed ? "展开目录" : "收起目录"}
            >
              {tocCollapsed ? "›" : "‹"}
            </button>
          </div>
          {!tocCollapsed && (
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-0.5">
                {toc.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => scrollTo(item.id)}
                    className={`w-full text-left rounded px-1.5 py-1 text-xs transition hover:bg-[#1a1a3e] ${
                      item.level === 1
                        ? "text-gray-300 font-medium"
                        : item.level === 2
                          ? "text-gray-400 pl-3"
                          : "text-gray-500 pl-5 text-[11px]"
                    }`}
                    title={item.text}
                  >
                    <span className="truncate block">{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto" id="article-content">
        <div className="w-full px-8 py-8">
          <div className="mb-6 pb-4 border-b border-[#1a1a3e]">
            <div className="flex items-center gap-2 text-[#e94560] text-xs mb-1">
              <Newspaper size={12} />
              <span>技术文章</span>
            </div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
          </div>
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
              components={{
                ...articleMdComponents,
                img: ({ src, alt }: { src?: string; alt?: string }) => {
                  const resolved = resolveImageSrc(src);
                  return (
                    <img
                      src={resolved}
                      alt={alt}
                      className="max-w-full rounded-lg border border-[#1a1a3e] my-4 cursor-zoom-in hover:border-[#e94560]/40 transition"
                    />
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
          <div className="h-20" />
        </div>
      </div>
    </div>
  );
}
