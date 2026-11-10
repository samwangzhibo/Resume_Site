import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ChartColumn,
  Eye,
  Users,
  LockOpen,
  Lock,
  Shield,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FileText,
  Upload,
  Trash2,
  Save,
  ExternalLink,
  LoaderCircle,
  Plus,
  GripVertical,
  Newspaper,
  BookOpen,
  FolderSearch,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
} from "recharts";
import { trpc } from "@/providers/trpc";

export default function Admin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"analytics" | "materials" | "articles" | "diag">("analytics");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const verifyPassword = trpc.aiConfig.verifyPassword.useMutation();
  const daily = trpc.analytics.daily.useQuery(undefined, { enabled: authed });
  const dayDetail = trpc.analytics.dayDetail.useQuery(
    { date: expandedDate || "" },
    { enabled: !!expandedDate && authed },
  );

  const login = async () => {
    if (!password.trim()) return;
    try {
      const res = await verifyPassword.mutateAsync({ password: password.trim() });
      if (res.valid) {
        setAuthed(true);
        setError("");
      } else {
        setError("密码错误");
      }
    } catch {
      setError("验证失败");
    }
  };

  const days = useMemo(() => (daily.data ? [...daily.data].reverse() : []), [daily.data]);

  if (!authed)
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white flex items-center justify-center">
        <div className="w-80 p-6 rounded-xl bg-[#12122a] border border-[#1a1a3e]">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-[#e94560]" />
            <h1 className="text-sm font-bold">管理后台</h1>
          </div>
          <p className="text-xs text-gray-500 mb-3">请输入密码进入后台</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") login();
              }}
              placeholder="输入密码"
              className="flex-1 bg-[#0a0a1a] border border-[#1a1a3e] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#e94560]/50"
            />
            <button
              onClick={login}
              className="px-3 py-2 rounded-lg bg-[#e94560] text-white text-xs hover:bg-[#d63a54] transition flex items-center gap-1"
            >
              <Lock size={10} />
              进入
            </button>
          </div>
          {error && <p className="text-[10px] text-red-400 mt-2">{error}</p>}
          <button
            onClick={() => navigate("/")}
            className="text-[10px] text-gray-500 hover:text-gray-300 mt-3 flex items-center gap-1"
          >
            <ArrowLeft size={10} /> 返回首页
          </button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#e94560]/20 flex items-center justify-center">
              <ChartColumn size={16} className="text-[#e94560]" />
            </div>
            <div>
              <h1 className="text-sm font-bold">管理后台</h1>
              <p className="text-[10px] text-gray-500">访问统计与项目材料管理</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] flex items-center gap-1">
              <LockOpen size={10} /> 已登录
            </span>
            <button
              onClick={() => navigate("/")}
              className="text-[10px] text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-[#1a1a3e] transition"
            >
              返回首页
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {(
            [
              { id: "analytics", label: "访问统计", icon: <ChartColumn size={12} /> },
              { id: "materials", label: "项目材料", icon: <FolderOpen size={12} /> },
              { id: "articles", label: "技术文章", icon: <BookOpen size={12} /> },
              { id: "diag", label: "文件诊断", icon: <FolderSearch size={12} /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 border ${
                tab === t.id
                  ? "bg-[#e94560]/15 text-[#e94560] border-[#e94560]/40"
                  : "bg-[#12122a] text-gray-400 border-[#1a1a3e] hover:text-gray-200"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === "materials" ? (
          <MaterialsManager password={password} />
        ) : tab === "articles" ? (
          <ArticlesManager password={password} />
        ) : tab === "diag" ? (
          <DiagManager password={password} />
        ) : (
          <>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard
            icon={<Eye size={14} />}
            label="总PV"
            value={days.reduce((sum, d) => sum + d.pv, 0)}
            color="text-blue-400"
          />
          <StatCard
            icon={<Users size={14} />}
            label="总UV"
            value={days.reduce((sum, d) => sum + d.uv, 0)}
            color="text-green-400"
          />
          <StatCard
            icon={<ChartColumn size={14} />}
            label="统计天数"
            value={days.length}
            color="text-amber-400"
          />
        </div>

        <div className="p-4 rounded-xl bg-[#12122a] border border-[#1a1a3e] mb-6">
          <h2 className="text-xs font-semibold text-gray-300 mb-4">每日 PV/UV 趋势</h2>
          {daily.isLoading ? (
            <div className="h-48 flex items-center justify-center text-gray-500 text-xs">
              加载中...
            </div>
          ) : days.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-500 text-xs">
              暂无数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={days} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a3e" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                  stroke="#1a1a3e"
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} stroke="#1a1a3e" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#12122a",
                    border: "1px solid #1a1a3e",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="pv"
                  name="PV"
                  stroke="#e94560"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="uv"
                  name="UV"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl bg-[#12122a] border border-[#1a1a3e] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a1a3e] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-300">每日访问明细</h2>
            <span className="text-[10px] text-gray-500">点击日期展开详情</span>
          </div>
          {daily.isLoading ? (
            <div className="p-8 text-center text-gray-500 text-xs">加载中...</div>
          ) : (
            <div className="divide-y divide-[#1a1a3e]">
              {days
                .slice()
                .reverse()
                .map((d) => (
                  <div key={d.date}>
                    <button
                      onClick={() => setExpandedDate(expandedDate === d.date ? null : d.date)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1a1a3e]/50 transition text-left"
                    >
                      {expandedDate === d.date ? (
                        <ChevronDown size={12} className="text-[#e94560]" />
                      ) : (
                        <ChevronRight size={12} className="text-gray-600" />
                      )}
                      <span className="text-xs font-medium text-gray-300 w-24">{d.date}</span>
                      <div className="flex-1 flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500">PV</span>
                          <span className="text-xs text-gray-300">{d.pv}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500">UV</span>
                          <span className="text-xs text-gray-400">{d.uv}</span>
                        </div>
                      </div>
                      <div className="w-24 h-3 bg-[#0a0a1a] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#e94560]/40 rounded-full"
                          style={{
                            width: `${Math.min(100, (d.pv / Math.max(...days.map((x) => x.pv))) * 100)}%`,
                          }}
                        />
                      </div>
                    </button>
                    {expandedDate === d.date && (
                      <div className="px-4 pb-3">
                        <DayDetailTable records={dayDetail.data || []} isLoading={dayDetail.isLoading} />
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================== 项目材料管理 ============================== */

interface MaterialItemData {
  id: string;
  label: string;
  tags: string[];
  category: "project" | "research";
  pdfUrl: string | null;
  pdfName: string | null;
  pdfSize: number | null;
}

function MaterialsManager({ password }: { password: string }) {
  const utils = trpc.useUtils();
  const list = trpc.projects.list.useQuery(undefined, { retry: false });
  const reorder = trpc.projects.reorder.useMutation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  /** 拖拽中的条目 id（同分组内排序） */
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  /** 本地排序覆盖（拖拽时即时反馈，保存后由服务端数据刷新） */
  const [localOrder, setLocalOrder] = useState<Record<string, string[]>>({});

  const refresh = () => {
    setLocalOrder({});
    utils.projects.list.invalidate();
  };

  const applyOrder = (category: string, orderedIds: string[]) => {
    setLocalOrder((prev) => ({ ...prev, [category]: orderedIds }));
    reorder.mutate({
      password,
      items: orderedIds.map((id, idx) => ({ id, sortOrder: idx })),
    });
  };

  if (list.isLoading)
    return (
      <div className="p-12 rounded-xl bg-[#12122a] border border-[#1a1a3e] text-center text-gray-500 text-xs">
        加载中...
      </div>
    );
  if (list.isError)
    return (
      <div className="p-12 rounded-xl bg-[#12122a] border border-[#1a1a3e] text-center text-gray-500 text-xs">
        项目数据加载失败，请稍后重试
      </div>
    );

  const items = list.data || [];
  const sortByLocal = (data: MaterialItemData[], category: string) => {
    const order = localOrder[category];
    if (!order) return data;
    const rank = new Map(order.map((id, idx) => [id, idx]));
    return [...data].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
  };
  const projects = sortByLocal(items.filter((i) => i.category === "project"), "project");
  const research = sortByLocal(items.filter((i) => i.category === "research"), "research");

  const handleDrop = (targetId: string, data: MaterialItemData[], category: string) => {
    const dragId = dragIdRef.current;
    setDragOverId(null);
    if (!dragId || dragId === targetId) return;
    const ids = data.map((d) => d.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    applyOrder(category, ids);
  };

  const renderGroup = (title: string, data: MaterialItemData[], category: string) => (
    <div key={title}>
      <div className="px-4 py-2 bg-[#0e0e1e]/70 border-b border-[#1a1a3e] flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-400">
          {title}（{data.length}）
        </span>
        {data.length > 1 && (
          <span className="text-[9px] text-gray-600 flex items-center gap-1">
            <GripVertical size={10} />
            拖拽调整顺序
          </span>
        )}
      </div>
      <div className="divide-y divide-[#1a1a3e]">
        {data.length === 0 ? (
          <div className="p-6 text-center text-gray-600 text-xs">暂无条目</div>
        ) : (
          data.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => {
                dragIdRef.current = item.id;
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIdRef.current && dragIdRef.current !== item.id) setDragOverId(item.id);
              }}
              onDragLeave={() => setDragOverId((cur) => (cur === item.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(item.id, data, category);
              }}
              onDragEnd={() => {
                dragIdRef.current = null;
                setDragOverId(null);
              }}
              className={`transition ${dragOverId === item.id ? "border-t-2 border-[#e94560]" : ""} ${dragIdRef.current === item.id ? "opacity-40" : ""} cursor-grab active:cursor-grabbing`}
            >
              <MaterialItem
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                password={password}
                onChanged={refresh}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl bg-[#12122a] border border-[#1a1a3e] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1a1a3e] flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-300">材料库（{items.length}）</h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 hidden sm:inline">点击条目展开编辑</span>
          <button
            onClick={() => setShowAddForm((s) => !s)}
            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#e94560] text-white hover:bg-[#d63a54] transition flex items-center gap-1"
          >
            <Plus size={11} />
            新增条目
          </button>
        </div>
      </div>

      {showAddForm && (
        <AddProjectForm
          password={password}
          onAdded={() => {
            setShowAddForm(false);
            refresh();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {items.length === 0 ? (
        <div className="p-12 text-center text-gray-600 text-xs">暂无条目，点击右上角「新增条目」创建</div>
      ) : (
        <>
          {renderGroup("项目材料", projects, "project")}
          {renderGroup("行业调研", research, "research")}
        </>
      )}
    </div>
  );
}

/* ============================== 技术文章同步管理 ============================== */

function ArticlesManager({ password }: { password: string }) {
  const utils = trpc.useUtils();
  const status = trpc.articles.syncStatus.useQuery(undefined, { retry: false });
  const list = trpc.articles.list.useQuery(undefined, { retry: false });
  const sync = trpc.articles.sync.useMutation({
    onSuccess: () => {
      utils.articles.syncStatus.invalidate();
      utils.articles.list.invalidate();
    },
  });

  const syncResult = sync.data;

  const lastSync = status.data?.lastSyncedAt
    ? new Date(status.data.lastSyncedAt).toLocaleString("zh-CN", { hour12: false })
    : "从未同步";

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#12122a] border border-[#1a1a3e] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1a1a3e]">
          <h2 className="text-xs font-semibold text-gray-300">文章仓库同步</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            从 Git 仓库拉取最新文章与图片，更新首页「技术文章」栏目
          </p>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-gray-500">仓库：</span>
              <span className="text-gray-300 font-mono text-[10px]">github.com/samwangzhibo/Result_Resume_Wiki</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-gray-500">方式：</span>
              <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">HTTPS 公开拉取（免凭证）</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-gray-500">上次同步：</span>
              <span className="text-gray-400">{lastSync}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => sync.mutate({ password })}
              disabled={sync.isPending || (status.data?.syncing ?? false)}
              className="text-[11px] px-3 py-2 rounded-lg bg-[#e94560] text-white hover:bg-[#d63a54] transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={12} className={sync.isPending ? "animate-spin" : ""} />
              {sync.isPending ? "正在拉取..." : status.data?.syncing ? "后台同步中..." : "拉取最新文章"}
            </button>
            <span className="text-[10px] text-gray-600">每次部署已内置最新文章；此按钮仅用于线上临时增量拉取，失败会自动回退内置版本</span>
          </div>

          {(syncResult?.logs?.length || (status.data?.logs?.length ?? 0) > 0) && (
            <div className="rounded-lg bg-[#0a0a14] border border-[#1a1a3e] px-3 py-2 max-h-48 overflow-y-auto">
              <p className="text-[10px] text-gray-500 mb-1.5">拉取日志</p>
              <pre className="text-[10px] leading-relaxed text-gray-400 font-mono whitespace-pre-wrap">
                {(syncResult?.logs ?? status.data?.logs ?? []).join("\n")}
              </pre>
            </div>
          )}

          {syncResult && (
            <div
              className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] ${
                syncResult.busy
                  ? "bg-amber-500/10 text-amber-400"
                  : syncResult.ok
                    ? "bg-green-500/10 text-green-400"
                    : "bg-red-500/10 text-red-400"
              }`}
            >
              {syncResult.busy ? (
                <RefreshCw size={13} className="shrink-0 mt-0.5 animate-spin" />
              ) : syncResult.ok ? (
                <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
              ) : (
                <XCircle size={13} className="shrink-0 mt-0.5" />
              )}
              <span>{syncResult.message}</span>
            </div>
          )}

        </div>
      </div>

      <div className="rounded-xl bg-[#12122a] border border-[#1a1a3e] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1a1a3e]">
          <h2 className="text-xs font-semibold text-gray-300">当前文章（{list.data?.length ?? 0}）</h2>
        </div>
        <div className="divide-y divide-[#1a1a3e]">
          {list.isLoading ? (
            <div className="p-8 text-center text-gray-500 text-xs">加载中...</div>
          ) : (list.data || []).length === 0 ? (
            <div className="p-8 text-center text-gray-600 text-xs">暂无文章，点击上方「拉取最新文章」同步</div>
          ) : (
            [...new Map((list.data || []).map((a) => [a.dir, (list.data || []).filter((x) => x.dir === a.dir)])).entries()].map(
              ([dir, items]) => (
                <div key={dir} className="px-4 py-2.5">
                  <p className="text-[10px] text-gray-500 mb-1.5">{dir}</p>
                  <div className="space-y-1">
                    {items.map((a) => (
                      <div key={a.path} className="flex items-center gap-2 pl-2">
                        <Newspaper size={11} className="text-gray-600 shrink-0" />
                        <span className="text-xs text-gray-300 truncate">{a.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* 新增项目表单 */
function AddProjectForm({
  password,
  onAdded,
  onCancel,
}: {
  password: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const utils = trpc.useUtils();
  const create = trpc.projects.create.useMutation({
    onSuccess: () => utils.projects.list.invalidate(),
  });
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [category, setCategory] = useState<"project" | "research">("project");
  const [error, setError] = useState("");

  const submit = async () => {
    if (!id.trim() || !label.trim()) {
      setError("ID 和名称不能为空");
      return;
    }
    setError("");
    try {
      await create.mutateAsync({
        password,
        id: id.trim(),
        label: label.trim(),
        tags: tagsStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        category,
      });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  };

  return (
    <div className="px-4 py-3 border-b border-[#1a1a3e] bg-[#0e0e1e]/70 space-y-2.5">
      <p className="text-[10px] font-semibold text-gray-300">新增条目</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">分类</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "project" | "research")}
            className="w-full bg-[#0a0a1a] border border-[#1a1a3e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#e94560]/50"
          >
            <option value="project">项目材料</option>
            <option value="research">行业调研</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">ID（唯一，小写字母/数字/连字符）</label>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="如 new-project"
            className="w-full bg-[#0a0a1a] border border-[#1a1a3e] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#e94560]/50"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">名称</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="如 直播XX系统建设"
            className="w-full bg-[#0a0a1a] border border-[#1a1a3e] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#e94560]/50"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">标签（逗号分隔，可空）</label>
          <input
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="如 架构, AI"
            className="w-full bg-[#0a0a1a] border border-[#1a1a3e] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#e94560]/50"
          />
        </div>
      </div>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={create.isPending}
          className="text-[10px] px-3 py-1.5 rounded bg-[#e94560] text-white hover:bg-[#d63a54] transition disabled:opacity-50"
        >
          {create.isPending ? "创建中..." : "确认创建"}
        </button>
        <button
          onClick={onCancel}
          className="text-[10px] px-3 py-1.5 rounded bg-[#1a1a3e] text-gray-300 hover:bg-[#2a2a4e] transition"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function MaterialItem({
  item,
  expanded,
  onToggle,
  password,
  onChanged,
}: {
  item: MaterialItemData;
  expanded: boolean;
  onToggle: () => void;
  password: string;
  onChanged: () => void;
}) {
  const utils = trpc.useUtils();
  const update = trpc.projects.update.useMutation({
    onSuccess: () => utils.projects.list.invalidate(),
  });
  const removeProject = trpc.projects.remove.useMutation({
    onSuccess: () => utils.projects.list.invalidate(),
  });

  const [label, setLabel] = useState(item.label);
  const [tagsStr, setTagsStr] = useState(item.tags.join(", "));
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"ok" | "err">("ok");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(item.label);
    setTagsStr(item.tags.join(", "));
  }, [item.label, item.tags]);

  const notify = (text: string, type: "ok" | "err" = "ok") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(""), 2500);
  };

  const saveMeta = async () => {
    if (!label.trim()) {
      notify("项目名不能为空", "err");
      return;
    }
    try {
      await update.mutateAsync({
        password,
        id: item.id,
        label: label.trim(),
        tags: tagsStr
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
      notify("已保存");
    } catch (err) {
      notify(err instanceof Error ? err.message : "保存失败", "err");
    }
  };

  const uploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/projects/${item.id}/pdf`, {
        method: "POST",
        headers: { "x-admin-password": password },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "上传失败");
      onChanged();
      notify("PDF 已更新");
    } catch (err) {
      notify(err instanceof Error ? err.message : "上传失败", "err");
    } finally {
      setUploading(false);
    }
  };

  const removePdf = async () => {
    if (!window.confirm(`确定移除「${item.label}」的 PDF 材料吗？`)) return;
    try {
      const res = await fetch(`/api/projects/${item.id}/pdf`, {
        method: "DELETE",
        headers: { "x-admin-password": password },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "移除失败");
      onChanged();
      notify("PDF 已移除");
    } catch (err) {
      notify(err instanceof Error ? err.message : "移除失败", "err");
    }
  };

  const deleteProject = async () => {
    if (
      !window.confirm(
        `确定删除项目「${item.label}」吗？\n\n将同时删除其 PDF 材料，且不可恢复。`,
      )
    )
      return;
    try {
      await removeProject.mutateAsync({ password, id: item.id });
      onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : "删除失败", "err");
    }
  };

  const pdfSizeText = item.pdfSize ? `${(item.pdfSize / 1024).toFixed(0)} KB` : "";

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a1a3e]/50 transition text-left"
      >
        {expanded ? (
          <ChevronDown size={12} className="text-[#e94560]" />
        ) : (
          <ChevronRight size={12} className="text-gray-600" />
        )}
        <FileText size={13} className={expanded ? "text-[#e94560]" : "text-gray-500"} />
        <span className="text-xs font-medium text-gray-200">{item.label}</span>
        <span className="flex gap-1">
          {item.tags.map((t) => (
            <span
              key={t}
              className="px-1.5 py-0.5 rounded-full bg-[#0f3460]/50 text-blue-400 text-[9px] border border-[#1a1a3e]"
            >
              {t}
            </span>
          ))}
        </span>
        <span
          className={`ml-auto px-1.5 py-0.5 rounded text-[9px] ${
            item.pdfUrl ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-500"
          }`}
        >
          {item.pdfUrl ? "有 PDF" : "无 PDF"}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 bg-[#0e0e1e]/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">项目名</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full bg-[#0a0a1a] border border-[#1a1a3e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#e94560]/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">标签（逗号分隔）</label>
              <input
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="架构重构, 工程提效, 商业化"
                className="w-full bg-[#0a0a1a] border border-[#1a1a3e] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#e94560]/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-500">PDF 材料：</span>
            {item.pdfUrl ? (
              <>
                <a
                  href={item.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:text-blue-300 transition flex items-center gap-1"
                >
                  <ExternalLink size={10} />
                  {item.pdfName || "查看当前 PDF"}
                  {pdfSizeText && <span className="text-gray-500">（{pdfSizeText}）</span>}
                </a>
                <button
                  onClick={removePdf}
                  className="text-[10px] px-2 py-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition flex items-center gap-1"
                >
                  <Trash2 size={10} />
                  移除
                </button>
              </>
            ) : (
              <span className="text-[10px] text-gray-600">未上传</span>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-[10px] px-2 py-1 rounded bg-[#1a1a3e] text-gray-300 hover:bg-[#2a2a4e] transition flex items-center gap-1 disabled:opacity-50"
            >
              {uploading ? <LoaderCircle size={10} className="animate-spin" /> : <Upload size={10} />}
              {uploading ? "上传中..." : item.pdfUrl ? "替换 PDF" : "上传 PDF"}
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={uploadPdf} className="hidden" />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveMeta}
              disabled={update.isPending}
              className="text-[10px] px-3 py-1.5 rounded bg-[#e94560] text-white hover:bg-[#d63a54] transition flex items-center gap-1 disabled:opacity-50"
            >
              <Save size={10} />
              {update.isPending ? "保存中..." : "保存修改"}
            </button>
            {message && (
              <span className={`text-[10px] ${messageType === "ok" ? "text-green-400" : "text-red-400"}`}>
                {message}
              </span>
            )}
            <button
              onClick={deleteProject}
              disabled={removeProject.isPending}
              className="ml-auto text-[10px] px-3 py-1.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 size={10} />
              {removeProject.isPending ? "删除中..." : "删除项目"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface VisitRecord {
  id: number;
  createdAt: Date;
  ip: string | null;
  path: string | null;
  ua: string | null;
}

function DayDetailTable({ records, isLoading }: { records: VisitRecord[]; isLoading: boolean }) {
  if (isLoading)
    return <div className="py-4 text-center text-gray-500 text-xs">加载详情...</div>;
  if (records.length === 0)
    return <div className="py-4 text-center text-gray-500 text-xs">当日无记录</div>;
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-gray-500 border-b border-[#1a1a3e]">
            <th className="text-left py-1.5 px-2">时间</th>
            <th className="text-left py-1.5 px-2">IP</th>
            <th className="text-left py-1.5 px-2">页面</th>
            <th className="text-left py-1.5 px-2">设备</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const d = new Date(r.createdAt);
            const time =
              d.getHours().toString().padStart(2, "0") +
              ":" +
              d.getMinutes().toString().padStart(2, "0") +
              ":" +
              d.getSeconds().toString().padStart(2, "0");
            const ua = r.ua || "";
            const device = ua.includes("iPhone")
              ? "iPhone"
              : ua.includes("Android")
                ? "Android"
                : ua.includes("Mac")
                  ? "Mac"
                  : "Other";
            return (
              <tr key={r.id} className="border-b border-[#1a1a3e]/30 hover:bg-[#1a1a3e]/20">
                <td className="py-1.5 px-2 text-gray-400 font-mono">{time}</td>
                <td className="py-1.5 px-2 text-gray-300">{(r.ip || "").split(",")[0]}</td>
                <td className="py-1.5 px-2 text-gray-400 truncate max-w-[200px]">
                  {(r.path || "/").slice(0, 40)}
                </td>
                <td className="py-1.5 px-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] ${
                      device === "iPhone"
                        ? "bg-blue-500/20 text-blue-400"
                        : device === "Android"
                          ? "bg-green-500/20 text-green-400"
                          : device === "Mac"
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {device}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-[#12122a] border border-[#1a1a3e] text-center">
      <div className={`flex justify-center mb-2 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}


/* ============================== 线上文件诊断 ============================== */

interface FileNode {
  name: string;
  type: "dir" | "file";
  size?: number;
  children?: FileNode[];
}

function fmtSize(n?: number) {
  if (n === undefined) return "";
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.round(n / 1024)}KB`;
}

function TreeNode({ node, depth }: { node: FileNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-[#1a1a3e]/50 ${node.type === "dir" ? "cursor-pointer" : ""}`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        onClick={() => node.type === "dir" && setOpen((o) => !o)}
      >
        {node.type === "dir" ? (
          <>
            <ChevronRight size={11} className={`text-gray-500 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
            <FolderOpen size={11} className="text-amber-400 shrink-0" />
            <span className="text-[11px] text-gray-300">{node.name}/</span>
          </>
        ) : (
          <>
            <span className="w-[11px] shrink-0" />
            <Newspaper size={10} className="text-gray-600 shrink-0" />
            <span className="text-[11px] text-gray-400 truncate">{node.name}</span>
            <span className="text-[9px] text-gray-600 ml-auto shrink-0">{fmtSize(node.size)}</span>
          </>
        )}
      </div>
      {open && node.children?.map((child) => <TreeNode key={`${depth}-${child.name}`} node={child} depth={depth + 1} />)}
    </div>
  );
}

const DIAG_DIRS = [
  { id: "uploads", label: "uploads（运行时）" },
  { id: "uploads/pdfs", label: "uploads/pdfs（PDF缓存）" },
  { id: "uploads/articles", label: "uploads/articles（文章）" },
  { id: "assets", label: "assets（部署包）" },
  { id: "assets/articles", label: "assets/articles（内置文章）" },
];

function DiagManager({ password }: { password: string }) {
  const [dir, setDir] = useState("uploads");
  const tree = trpc.diag.fileTree.useQuery({ password, dir }, { retry: false });
  const bindings = trpc.diag.pdfBindings.useQuery({ password }, { retry: false });

  return (
    <div className="space-y-4">
      {/* PDF 绑定关系 */}
      <div className="rounded-xl bg-[#12122a] border border-[#1a1a3e] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1a1a3e] flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-gray-300">PDF 绑定关系（数据库 item ↔ 磁盘位置）</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {bindings.data ? `工作目录 ${bindings.data.cwd} · 数据库${bindings.data.dbReachable ? "可达" : "不可达"}` : "加载中..."}
            </p>
          </div>
          <button
            onClick={() => { bindings.refetch(); tree.refetch(); }}
            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#1a1a3e] text-gray-300 hover:bg-[#2a2a4e] transition flex items-center gap-1"
          >
            <RefreshCw size={11} /> 刷新
          </button>
        </div>
        <div className="overflow-x-auto">
          {bindings.isLoading ? (
            <div className="p-8 text-center text-gray-500 text-xs">加载中...</div>
          ) : bindings.error ? (
            <div className="p-8 text-center text-red-400 text-xs">{bindings.error.message}</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-500 border-b border-[#1a1a3e]">
                  <th className="text-left px-4 py-2 font-medium">item</th>
                  <th className="text-left px-2 py-2 font-medium">数据库</th>
                  <th className="text-left px-2 py-2 font-medium">uploads缓存</th>
                  <th className="text-left px-2 py-2 font-medium">assets资产</th>
                  <th className="text-left px-2 py-2 font-medium">内置</th>
                  <th className="text-left px-4 py-2 font-medium">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a3e]/60">
                {(bindings.data?.rows ?? []).map((r) => (
                  <tr key={r.id} className="text-gray-400">
                    <td className="px-4 py-2 text-gray-200 font-mono">{r.id}</td>
                    <td className="px-2 py-2">{r.dbSize !== null ? fmtSize(r.dbSize) : <span className="text-gray-600">无</span>}</td>
                    <td className="px-2 py-2">{r.uploadsSize !== null ? fmtSize(r.uploadsSize) : <span className="text-gray-600">无</span>}</td>
                    <td className="px-2 py-2">{r.assetsSize !== null ? fmtSize(r.assetsSize) : <span className="text-gray-600">无</span>}</td>
                    <td className="px-2 py-2">{r.embedded ? <span className="text-green-400">有</span> : <span className="text-gray-600">无</span>}</td>
                    <td className="px-4 py-2">
                      <span className={r.status.startsWith("正常") ? "text-green-400" : r.status.startsWith("异常") ? "text-red-400" : "text-amber-400"}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 文件目录树 */}
      <div className="rounded-xl bg-[#12122a] border border-[#1a1a3e] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1a1a3e]">
          <h2 className="text-xs font-semibold text-gray-300">线上文件目录</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">服务器上的实际文件结构（忽略 . 开头与 node_modules）</p>
        </div>
        <div className="p-3">
          <div className="flex gap-1.5 flex-wrap mb-3">
            {DIAG_DIRS.map((d) => (
              <button
                key={d.id}
                onClick={() => setDir(d.id)}
                className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition ${
                  dir === d.id
                    ? "bg-[#e94560]/15 text-[#e94560] border-[#e94560]/40"
                    : "bg-[#0e0e1e] text-gray-400 border-[#1a1a3e] hover:text-gray-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="rounded-lg bg-[#0a0a14] border border-[#1a1a3e] p-2 max-h-96 overflow-auto font-mono">
            {tree.isLoading ? (
              <div className="p-6 text-center text-gray-500 text-xs">加载中...</div>
            ) : tree.error ? (
              <div className="p-6 text-center text-red-400 text-xs">{tree.error.message}</div>
            ) : (tree.data?.tree ?? []).length === 0 ? (
              <div className="p-6 text-center text-gray-600 text-xs">目录为空或不存在</div>
            ) : (
              (tree.data?.tree ?? []).map((node) => <TreeNode key={node.name} node={node} depth={0} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
