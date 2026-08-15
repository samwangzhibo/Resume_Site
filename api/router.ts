import { createRouter, publicQuery } from "./middleware";
import { aiConfigRouter, presetsRouter, analyticsRouter, projectsRouter, articlesRouter, diagRouter, aiRouter } from "./routers";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  aiConfig: aiConfigRouter,
  ai: aiRouter,
  presets: presetsRouter,
  analytics: analyticsRouter,
  projects: projectsRouter,
  articles: articlesRouter,
  diag: diagRouter,
});

export type AppRouter = typeof appRouter;
