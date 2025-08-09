import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { db } from "../db";
import { landingPageCache } from "../db/schema/ad-copy";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  success: boolean;
  error?: string;
  metadata: {
    description?: string;
    keywords?: string[];
    ogTitle?: string;
    ogDescription?: string;
    scrapedAt: string;
    processingTime: number;
    method: "cheerio" | "puppeteer";
    contentLength: number;
  };
}

export class WebScraperService {
  private static readonly MAX_CONTENT_LENGTH = 10000; // Limit content length
  private static readonly TIMEOUT = 30000; // 30 seconds timeout
  private static readonly CACHE_DURATION_DAYS = 7; // Cache for 7 days

  /**
   * Check if URL content is cached and fresh
   */
  static async getCachedContent(url: string): Promise<ScrapedContent | null> {
    try {
      const cached = await db
        .select()
        .from(landingPageCache)
        .where(eq(landingPageCache.url, url))
        .limit(1);

      if (!cached[0]) return null;

      // Check if cache is still fresh (within cache duration)
      const cacheDate = new Date(cached[0].createdAt);
      const now = new Date();
      const daysDiff =
        (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff > this.CACHE_DURATION_DAYS) {
        // Cache is stale, delete it
        await db.delete(landingPageCache).where(eq(landingPageCache.url, url));
        return null;
      }

      return {
        url: cached[0].url,
        title: cached[0].title || "",
        content: cached[0].content,
        success: true,
        metadata: {
          description: cached[0].metadata?.description,
          keywords: cached[0].metadata?.keywords,
          ogTitle: cached[0].metadata?.ogTitle,
          ogDescription: cached[0].metadata?.ogDescription,
          scrapedAt:
            cached[0].metadata?.scrapedAt || cached[0].createdAt.toISOString(),
          processingTime: 0,
          method: "cheerio",
          contentLength: cached[0].content.length,
        },
      };
    } catch (error) {
      console.error("Error checking cache:", error);
      return null;
    }
  }

  /**
   * Cache scraped content
   */
  static async cacheContent(scrapedContent: ScrapedContent): Promise<void> {
    try {
      const now = new Date();
      const id = nanoid();

      // Check if URL already exists in cache
      const existing = await db
        .select()
        .from(landingPageCache)
        .where(eq(landingPageCache.url, scrapedContent.url))
        .limit(1);

      if (existing[0]) {
        // Update existing cache
        await db
          .update(landingPageCache)
          .set({
            title: scrapedContent.title,
            content: scrapedContent.content,
            metadata: scrapedContent.metadata,
            updatedAt: now,
          })
          .where(eq(landingPageCache.url, scrapedContent.url));
      } else {
        // Insert new cache entry
        await db.insert(landingPageCache).values({
          id,
          url: scrapedContent.url,
          title: scrapedContent.title,
          content: scrapedContent.content,
          metadata: scrapedContent.metadata,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      console.error("Error caching content:", error);
    }
  }

  /**
   * Scrape content using Cheerio (faster, for simple pages)
   */
  static async scrapeWithCheerio(url: string): Promise<ScrapedContent> {
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          Connection: "keep-alive",
        },
        signal: AbortSignal.timeout(this.TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract title
      const title =
        $("title").text().trim() ||
        $("h1").first().text().trim() ||
        "No title found";

      // Extract meta description
      const description =
        $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        "";

      // Extract keywords
      const keywordsContent = $('meta[name="keywords"]').attr("content") || "";
      const keywords = keywordsContent
        ? keywordsContent.split(",").map((k) => k.trim())
        : [];

      // Extract Open Graph data
      const ogTitle = $('meta[property="og:title"]').attr("content") || "";
      const ogDescription =
        $('meta[property="og:description"]').attr("content") || "";

      // Extract main content
      let content = "";

      // Remove unwanted elements
      $(
        "script, style, nav, header, footer, aside, .advertisement, .ads, .social-share"
      ).remove();

      // Try to find main content areas
      const contentSelectors = [
        "main",
        '[role="main"]',
        ".main-content",
        ".content",
        ".post-content",
        ".article-content",
        ".page-content",
        "article",
        ".container",
        "body",
      ];

      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text().trim();
          if (content.length > 100) break; // Found substantial content
        }
      }

      // Clean up content
      content = content
        .replace(/\s+/g, " ") // Replace multiple whitespace with single space
        .replace(/\n+/g, "\n") // Replace multiple newlines with single newline
        .trim();

      // Limit content length
      if (content.length > this.MAX_CONTENT_LENGTH) {
        content = content.substring(0, this.MAX_CONTENT_LENGTH) + "...";
      }

      const processingTime = Date.now() - startTime;

      return {
        url,
        title,
        content,
        success: true,
        metadata: {
          description,
          keywords,
          ogTitle,
          ogDescription,
          scrapedAt: new Date().toISOString(),
          processingTime,
          method: "cheerio",
          contentLength: content.length,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      return {
        url,
        title: "",
        content: "",
        success: false,
        error: `Cheerio scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          scrapedAt: new Date().toISOString(),
          processingTime,
          method: "cheerio",
          contentLength: 0,
        },
      };
    }
  }

  /**
   * Scrape content using Puppeteer (for JavaScript-heavy pages)
   */
  static async scrapeWithPuppeteer(url: string): Promise<ScrapedContent> {
    const startTime = Date.now();
    let browser;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();

      // Set user agent and viewport
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      );
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to page with timeout
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: this.TIMEOUT,
      });

      // Wait for content to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Extract data
      const pageData = await page.evaluate(() => {
        // Remove unwanted elements
        const unwantedSelectors = [
          "script",
          "style",
          "nav",
          "header",
          "footer",
          "aside",
          ".advertisement",
          ".ads",
          ".social-share",
        ];
        unwantedSelectors.forEach((selector) => {
          document.querySelectorAll(selector).forEach((el) => el.remove());
        });

        const title =
          document.title ||
          document.querySelector("h1")?.textContent ||
          "No title found";

        const description =
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") ||
          document
            .querySelector('meta[property="og:description"]')
            ?.getAttribute("content") ||
          "";

        const keywordsContent =
          document
            .querySelector('meta[name="keywords"]')
            ?.getAttribute("content") || "";
        const keywords = keywordsContent
          ? keywordsContent.split(",").map((k) => k.trim())
          : [];

        const ogTitle =
          document
            .querySelector('meta[property="og:title"]')
            ?.getAttribute("content") || "";
        const ogDescription =
          document
            .querySelector('meta[property="og:description"]')
            ?.getAttribute("content") || "";

        // Extract main content
        const contentSelectors = [
          "main",
          '[role="main"]',
          ".main-content",
          ".content",
          ".post-content",
          ".article-content",
          ".page-content",
          "article",
          ".container",
          "body",
        ];
        let content = "";

        for (const selector of contentSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            content = element.textContent || "";
            if (content.length > 100) break;
          }
        }

        return {
          title: title.trim(),
          description,
          keywords,
          ogTitle,
          ogDescription,
          content: content.trim(),
        };
      });

      await browser.close();

      // Clean up content
      let content = pageData.content
        .replace(/\s+/g, " ")
        .replace(/\n+/g, "\n")
        .trim();

      // Limit content length
      if (content.length > this.MAX_CONTENT_LENGTH) {
        content = content.substring(0, this.MAX_CONTENT_LENGTH) + "...";
      }

      const processingTime = Date.now() - startTime;

      return {
        url,
        title: pageData.title,
        content,
        success: true,
        metadata: {
          description: pageData.description,
          keywords: pageData.keywords,
          ogTitle: pageData.ogTitle,
          ogDescription: pageData.ogDescription,
          scrapedAt: new Date().toISOString(),
          processingTime,
          method: "puppeteer",
          contentLength: content.length,
        },
      };
    } catch (error) {
      if (browser) {
        await browser.close();
      }

      const processingTime = Date.now() - startTime;

      return {
        url,
        title: "",
        content: "",
        success: false,
        error: `Puppeteer scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          scrapedAt: new Date().toISOString(),
          processingTime,
          method: "puppeteer",
          contentLength: 0,
        },
      };
    }
  }

  /**
   * Scrape content with automatic fallback (Cheerio first, then Puppeteer)
   */
  static async scrapeContent(
    url: string,
    useCache: boolean = true
  ): Promise<ScrapedContent> {
    try {
      // Validate URL
      new URL(url);

      // Check cache first
      if (useCache) {
        const cached = await this.getCachedContent(url);
        if (cached) {
          return cached;
        }
      }

      // Try Cheerio first (faster)
      let result = await this.scrapeWithCheerio(url);

      // If Cheerio fails or returns minimal content, try Puppeteer
      if (!result.success || result.content.length < 100) {
        console.log(
          `Cheerio failed or returned minimal content for ${url}, trying Puppeteer...`
        );
        result = await this.scrapeWithPuppeteer(url);
      }

      // Cache the result if successful
      if (result.success && useCache) {
        await this.cacheContent(result);
      }

      return result;
    } catch (error) {
      return {
        url,
        title: "",
        content: "",
        success: false,
        error: `URL validation or scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          scrapedAt: new Date().toISOString(),
          processingTime: 0,
          method: "cheerio",
          contentLength: 0,
        },
      };
    }
  }

  /**
   * Scrape multiple URLs in batch
   */
  static async scrapeMultipleUrls(
    urls: string[],
    useCache: boolean = true
  ): Promise<ScrapedContent[]> {
    const results: ScrapedContent[] = [];

    // Process URLs sequentially to avoid overwhelming the target servers
    for (const url of urls) {
      try {
        const result = await this.scrapeContent(url, useCache);
        results.push(result);

        // Add delay between requests to be respectful
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          url,
          title: "",
          content: "",
          success: false,
          error: `Batch scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          metadata: {
            scrapedAt: new Date().toISOString(),
            processingTime: 0,
            method: "cheerio",
            contentLength: 0,
          },
        });
      }
    }

    return results;
  }

  /**
   * Clean up old cache entries
   */
  static async cleanupCache(maxAgeInDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

      const result = await db
        .delete(landingPageCache)
        .where(eq(landingPageCache.createdAt, cutoffDate));

      return result.rowCount || 0;
    } catch (error) {
      console.error("Error cleaning up cache:", error);
      return 0;
    }
  }
}
