import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const integration = pgTable("integration", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  provider: text("provider").notNull(), // 'dropbox', 'google-drive', etc.
  providerAccountId: text("provider_account_id").notNull(), // The account ID from the provider
  providerAccountEmail: text("provider_account_email"), // Email associated with the provider account
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scope: text("scope"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
