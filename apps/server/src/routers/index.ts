import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { todoRouter } from "./todo";
import { integrationRouter } from "./integration";
import { adCopyRouter } from "./ad-copy";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  todo: todoRouter,
  integration: integrationRouter,
  adCopy: adCopyRouter,
});
export type AppRouter = typeof appRouter;
