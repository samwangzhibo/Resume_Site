import {
  mysqlTable,
  serial,
  varchar,
  text,
  int,
  timestamp,
} from "drizzle-orm/mysql-core";
import { longtext } from "drizzle-orm/mysql-core";

/** 页面访问记录 */
export const visits = mysqlTable("visits", {
  id: serial("id").primaryKey(),
  ua: varchar("ua", { length: 1024 }),
  path: varchar("path", { length: 512 }),
  referrer: varchar("referrer", { length: 1024 }),
  fingerprint: varchar("fingerprint", { length: 64 }),
  sessionId: varchar("session_id", { length: 64 }),
  ip: varchar("ip", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** 数字分身对话记录 */
export const conversations = mysqlTable("conversations", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  source: varchar("source", { length: 16 }).notNull().default("ai"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** AI 配置（知识库等 KV 存储） */
export const aiConfig = mysqlTable("ai_config", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  content: text("content"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

/** 项目材料（后台可编辑：项目名、标签、PDF 文件路径、分类） */
export const projectMaterials = mysqlTable("project_materials", {
  id: varchar("id", { length: 32 }).primaryKey(),
  label: varchar("label", { length: 255 }).notNull(),
  tags: text("tags"),
  sortOrder: int("sort_order").notNull().default(0),
  /** 分类：project=项目材料，research=行业调研 */
  category: varchar("category", { length: 16 }).notNull().default("project"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

/** 用户上传 PDF 的持久副本（base64），跨部署/容器清理不丢，启动时恢复到磁盘 */
export const pdfBlobs = mysqlTable("pdf_blobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  data: longtext("data").notNull(),
  size: int("size").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export type Visit = typeof visits.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type AiConfig = typeof aiConfig.$inferSelect;
export type ProjectMaterialRow = typeof projectMaterials.$inferSelect;
export type PdfBlobRow = typeof pdfBlobs.$inferSelect;
