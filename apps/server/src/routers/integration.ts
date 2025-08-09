import { z } from "zod";
import { protectedProcedure, router } from "../lib/trpc";
import { db } from "../db";
import { integration } from "../db/schema/integrations";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

// Dropbox OAuth configuration
const DROPBOX_CLIENT_ID = process.env.DROPBOX_CLIENT_ID || "";
const DROPBOX_CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET || "";
const DROPBOX_REDIRECT_URI =
  process.env.DROPBOX_REDIRECT_URI ||
  `${process.env.BETTER_AUTH_URL}/api/integrations/dropbox/callback`;

export const integrationRouter = router({
  // Get all connected integrations for the current user
  getConnectedIntegrations: protectedProcedure.query(async ({ ctx }) => {
    const connectedIntegrations = await db
      .select({
        id: integration.id,
        provider: integration.provider,
        providerAccountId: integration.providerAccountId,
        providerAccountEmail: integration.providerAccountEmail,
        createdAt: integration.createdAt,
        scope: integration.scope,
        isActive: integration.isActive,
      })
      .from(integration)
      .where(
        and(
          eq(integration.userId, ctx.session.user.id),
          eq(integration.isActive, true)
        )
      );

    return connectedIntegrations.map((int) => ({
      id: int.id,
      provider: int.provider,
      accountId: int.providerAccountId,
      accountEmail: int.providerAccountEmail,
      connectedAt: int.createdAt,
      scope: int.scope,
    }));
  }),

  // Disconnect an integration
  disconnectIntegration: protectedProcedure
    .input(
      z.object({
        integrationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the integration belongs to the current user before deleting
      const existingIntegration = await db
        .select()
        .from(integration)
        .where(
          and(
            eq(integration.id, input.integrationId),
            eq(integration.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (existingIntegration.length === 0) {
        throw new Error("Integration not found or access denied");
      }

      // Soft delete by setting isActive to false
      await db
        .update(integration)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(integration.id, input.integrationId),
            eq(integration.userId, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  // Get integration status for a specific provider
  getIntegrationStatus: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const integrations = await db
        .select({
          id: integration.id,
          providerAccountId: integration.providerAccountId,
          providerAccountEmail: integration.providerAccountEmail,
          createdAt: integration.createdAt,
          scope: integration.scope,
        })
        .from(integration)
        .where(
          and(
            eq(integration.userId, ctx.session.user.id),
            eq(integration.provider, input.provider),
            eq(integration.isActive, true)
          )
        );

      return {
        isConnected: integrations.length > 0,
        integrations: integrations,
      };
    }),

  // Store OAuth credentials after successful authorization
  storeIntegration: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
        providerAccountId: z.string(),
        providerAccountEmail: z.string().optional(),
        accessToken: z.string(),
        refreshToken: z.string().optional(),
        tokenExpiresAt: z.date().optional(),
        scope: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const integrationId = nanoid();
      const now = new Date();

      await db.insert(integration).values({
        id: integrationId,
        userId: ctx.session.user.id,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        providerAccountEmail: input.providerAccountEmail,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        tokenExpiresAt: input.tokenExpiresAt,
        scope: input.scope,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, integrationId };
    }),

  // Generate Dropbox OAuth URL
  getDropboxAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const state = nanoid(); // Use as CSRF protection
    const scope =
      "account_info.read files.content.read files.content.write files.metadata.read";

    const authUrl = new URL("https://www.dropbox.com/oauth2/authorize");
    authUrl.searchParams.set("client_id", DROPBOX_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", DROPBOX_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("token_access_type", "offline"); // Request refresh token

    return {
      authUrl: authUrl.toString(),
      state,
    };
  }),

  // Handle Dropbox OAuth callback
  handleDropboxCallback: protectedProcedure
    .input(
      z.object({
        code: z.string(),
        state: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Exchange code for access token
        const tokenResponse = await fetch(
          "https://api.dropboxapi.com/oauth2/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              code: input.code,
              grant_type: "authorization_code",
              client_id: DROPBOX_CLIENT_ID,
              client_secret: DROPBOX_CLIENT_SECRET,
              redirect_uri: DROPBOX_REDIRECT_URI,
            }),
          }
        );

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error("Token exchange error:", errorText);
          throw new Error(
            `Failed to exchange code for token: ${tokenResponse.status} - ${errorText}`
          );
        }

        const tokenData = await tokenResponse.json();

        console.log("Token exchange successful:", {
          hasAccessToken: !!tokenData.access_token,
          tokenType: tokenData.token_type,
          scope: tokenData.scope,
        });

        // Get user info from Dropbox
        const userResponse = await fetch(
          "https://api.dropboxapi.com/2/users/get_current_account",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
            },
            // No body - Dropbox API expects no request body for this endpoint
          }
        );

        console.log("User info response status:", userResponse.status);

        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          console.error("Dropbox user info error:", errorText);
          throw new Error(
            `Failed to get user info: ${userResponse.status} - ${errorText}`
          );
        }

        const userData = await userResponse.json();
        console.log("User data received:", {
          accountId: userData.account_id,
          email: userData.email,
          name: userData.name?.display_name,
        });

        // Store the integration
        const integrationId = nanoid();
        const now = new Date();

        await db.insert(integration).values({
          id: integrationId,
          userId: ctx.session.user.id,
          provider: "dropbox",
          providerAccountId: userData.account_id,
          providerAccountEmail: userData.email,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null,
          scope: tokenData.scope,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });

        return {
          success: true,
          integrationId,
          accountEmail: userData.email,
        };
      } catch (error) {
        throw new Error(
          `OAuth callback failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  // Refresh Dropbox access token using refresh token
  refreshDropboxToken: protectedProcedure
    .input(
      z.object({
        integrationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the integration with refresh token
      const existingIntegration = await db
        .select()
        .from(integration)
        .where(
          and(
            eq(integration.id, input.integrationId),
            eq(integration.userId, ctx.session.user.id),
            eq(integration.provider, "dropbox"),
            eq(integration.isActive, true)
          )
        )
        .limit(1);

      if (existingIntegration.length === 0) {
        throw new Error("Integration not found");
      }

      const integrationData = existingIntegration[0];

      if (!integrationData.refreshToken) {
        throw new Error(
          "No refresh token available. Re-authorization required."
        );
      }

      try {
        // Use refresh token to get new access token
        const tokenResponse = await fetch(
          "https://api.dropboxapi.com/oauth2/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: integrationData.refreshToken,
              client_id: DROPBOX_CLIENT_ID,
              client_secret: DROPBOX_CLIENT_SECRET,
            }),
          }
        );

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error("Token refresh error:", errorText);
          throw new Error(
            `Failed to refresh token: ${tokenResponse.status} - ${errorText}`
          );
        }

        const tokenData = await tokenResponse.json();

        console.log("Token refresh successful:", {
          hasAccessToken: !!tokenData.access_token,
          expiresIn: tokenData.expires_in,
        });

        // Update the integration with new access token
        const now = new Date();
        await db
          .update(integration)
          .set({
            accessToken: tokenData.access_token,
            tokenExpiresAt: tokenData.expires_in
              ? new Date(Date.now() + tokenData.expires_in * 1000)
              : null,
            updatedAt: now,
          })
          .where(eq(integration.id, input.integrationId));

        return { success: true };
      } catch (error) {
        throw new Error(
          `Token refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),
});
