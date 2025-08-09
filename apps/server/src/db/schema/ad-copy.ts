import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  json,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const adCopyProject = pgTable("ad_copy_project", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  platform: text("platform").notNull().default("facebook"), // facebook, google, tiktok, etc.
  landingPageUrls: json("landing_page_urls")
    .$type<string[]>()
    .notNull()
    .default([]),
  systemPrompt: text("system_prompt")
    .notNull()
    .default(
      "You are an expert ad copywriter. Create compelling, persuasive ad copy that drives conversions. Focus on benefits, use emotional triggers, and include clear calls-to-action."
    ),
  variationCount: integer("variation_count").notNull().default(3),
  status: text("status").notNull().default("draft"), // draft, processing, completed, failed
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const adCopyAsset = pgTable("ad_copy_asset", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => adCopyProject.id, { onDelete: "cascade" }),
  dropboxFileId: text("dropbox_file_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // image, video
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  dropboxPath: text("dropbox_path").notNull(),
  localPath: text("local_path"), // temporary local path for processing
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const assetInterpretationCache = pgTable("asset_interpretation_cache", {
  id: text("id").primaryKey(),
  dropboxFileId: text("dropbox_file_id").notNull().unique(),
  fileType: text("file_type").notNull(), // image, video
  interpretation: text("interpretation").notNull(),
  processingMethod: text("processing_method").notNull(), // gemini_vision, speech_to_text
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const adCopyGeneration = pgTable("ad_copy_generation", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => adCopyProject.id, { onDelete: "cascade" }),
  variationNumber: integer("variation_number").notNull(),
  platform: text("platform").notNull().default("facebook"), // facebook, google, tiktok, etc.
  variationType: text("variation_type").notNull(), // benefits, pain_agitation, storytelling
  content: json("content")
    .$type<{
      facebook?: {
        primaryText: string;
        headline: string;
      };
      google?: {
        headline: string;
        description1: string;
        description2?: string;
        path1?: string;
        path2?: string;
      };
      tiktok?: {
        caption: string;
        hashtags: string[];
      };
      // Legacy format for backward compatibility
      legacy?: {
        headline: string;
        body: string;
        callToAction: string;
      };
    }>()
    .notNull(),
  context: json("context")
    .$type<{
      assetInterpretations: string[];
      landingPageContent: string[];
      systemPrompt: string;
    }>()
    .notNull(),
  generationMetadata: json("generation_metadata").$type<{
    model: string;
    temperature: number;
    tokens: number;
    processingTime: number;
  }>(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const landingPageCache = pgTable("landing_page_cache", {
  id: text("id").primaryKey(),
  url: text("url").notNull().unique(),
  title: text("title"),
  content: text("content").notNull(),
  metadata: json("metadata").$type<{
    description?: string;
    keywords?: string[];
    ogTitle?: string;
    ogDescription?: string;
    scrapedAt: string;
  }>(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
