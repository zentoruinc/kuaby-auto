import { db } from "../db";
import { promptTemplate } from "../db/schema/ad-copy";
import { user } from "../db/schema/auth";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";

async function getFirstUser() {
  console.log("👤 Getting first user for default templates...");

  // Get the first user from the database
  const firstUser = await db.select().from(user).limit(1);

  if (firstUser.length === 0) {
    throw new Error(
      "No users found in database. Please create a user first before seeding prompt templates."
    );
  }

  console.log(
    `✅ Using user: ${firstUser[0].name || firstUser[0].email} (${firstUser[0].id})`
  );
  return firstUser[0].id;
}

async function seedPromptTemplates() {
  console.log("🌱 Seeding prompt templates...");

  // Get the first user to assign default templates to
  const firstUserId = await getFirstUser();

  // Facebook Default Template
  const facebookTemplateId = nanoid();
  const facebookSections = [
    {
      id: "intro",
      name: "Introduction",
      content: `You are an experienced ad copywriter with extensive expertise in direct response copywriting. You produce persuasive, engaging Facebook ad copy that drives clicks, conversions, and overall campaign success.

PROJECT: {projectName}

TASK: Create Facebook ad copy following this EXACT structure:
1. Primary Text (main paragraph)
2. Headline (featuring free offering)

VARIATION TYPE: {variationType}`,
      editable: true,
      required: true,
      order: 1,
    },
    {
      id: "rules",
      name: "Formatting Rules",
      content: `STRICT FORMATTING RULES:
- Do NOT include dates, times, bold, italic, underline, or hyperlink formats
- Do NOT use em dashes
- Do NOT start Primary Text with a headline - go directly into the main paragraph
- Use emojis ONLY in bullet points within Primary Text
- Craft headlines that prominently feature the free offering (e.g., 'Free Online Summit: xxx', 'Free Webinar: xxx', 'Free eBook: xxx')`,
      editable: true,
      required: true,
      order: 2,
    },
    {
      id: "structure",
      name: "Primary Text Structure",
      content: `PRIMARY TEXT STRUCTURE:
1. Start with a hook considering myths, goals, fears, or frustrations of the target audience
2. Include compelling story or narrative (if available from context)
3. Add emoji bullet list highlighting benefits/outcomes the audience will experience
4. End with call-to-action paired with social proof or scarcity component`,
      editable: true,
      required: true,
      order: 3,
    },
    {
      id: "assets",
      name: "Asset Context",
      content: `VISUAL/AUDIO ASSETS CONTEXT:
{assetInterpretations}`,
      editable: false,
      required: false,
      order: 4,
    },
    {
      id: "landing_pages",
      name: "Landing Page Content",
      content: `LANDING PAGE CONTENT:
{landingPageContent}`,
      editable: false,
      required: false,
      order: 5,
    },
    {
      id: "output_format",
      name: "Output Format",
      content: `OUTPUT FORMAT:
PRIMARY_TEXT: [Your primary text here - no headline, direct into main paragraph with hook, story, emoji bullets, and CTA with social proof/scarcity]

HEADLINE: [Your headline featuring free offering]

Generate the Facebook ad copy now:`,
      editable: true,
      required: true,
      order: 6,
    },
  ];

  // Check if Facebook template already exists
  const existingTemplates = await db
    .select()
    .from(promptTemplate)
    .where(
      and(
        eq(promptTemplate.promptType, "ad_copy"),
        eq(promptTemplate.isDefault, "true")
      )
    );

  const existingFacebookTemplate = existingTemplates.filter(
    (t) => t.template.platform === "facebook"
  );

  if (existingFacebookTemplate.length === 0) {
    await db.insert(promptTemplate).values({
      id: facebookTemplateId,
      userId: firstUserId,
      name: "Default Facebook Template",
      promptType: "ad_copy",
      isDefault: "true",
      template: {
        platform: "facebook",
        systemPrompt:
          "You are an expert Facebook ad copywriter specialized in creating high-converting ad copy that follows platform best practices.",
        sections: facebookSections,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✅ Created Facebook default template");
  } else {
    console.log("⏭️  Facebook default template already exists");
  }

  // Google Ads Default Template
  const googleTemplateId = nanoid();
  const googleSections = [
    {
      id: "intro",
      name: "Introduction",
      content: `You are an expert Google Ads copywriter. Create compelling, persuasive Google Ads copy that drives conversions and follows Google's advertising policies.

PROJECT: {projectName}

TASK: Create Google Ads copy with:
1. Headline (30 characters max)
2. Description 1 (90 characters max)
3. Description 2 (90 characters max, optional)

VARIATION TYPE: {variationType}`,
      editable: true,
      required: true,
      order: 1,
    },
    {
      id: "rules",
      name: "Google Ads Rules",
      content: `GOOGLE ADS REQUIREMENTS:
- Headlines: Maximum 30 characters
- Descriptions: Maximum 90 characters each
- Include relevant keywords naturally
- Clear call-to-action
- Comply with Google Ads policies
- Focus on benefits and value proposition`,
      editable: true,
      required: true,
      order: 2,
    },
    {
      id: "assets",
      name: "Asset Context",
      content: `VISUAL/AUDIO ASSETS CONTEXT:
{assetInterpretations}`,
      editable: false,
      required: false,
      order: 3,
    },
    {
      id: "landing_pages",
      name: "Landing Page Content",
      content: `LANDING PAGE CONTENT:
{landingPageContent}`,
      editable: false,
      required: false,
      order: 4,
    },
    {
      id: "output_format",
      name: "Output Format",
      content: `OUTPUT FORMAT:
HEADLINE: [Your headline here - max 30 characters]

DESCRIPTION1: [Your first description - max 90 characters]

DESCRIPTION2: [Your second description - max 90 characters, optional]

Generate the Google Ads copy now:`,
      editable: true,
      required: true,
      order: 5,
    },
  ];

  // Check if Google template already exists
  const existingGoogleTemplate = existingTemplates.filter(
    (t) => t.template.platform === "google"
  );

  if (existingGoogleTemplate.length === 0) {
    await db.insert(promptTemplate).values({
      id: googleTemplateId,
      userId: firstUserId,
      name: "Default Google Ads Template",
      promptType: "ad_copy",
      isDefault: "true",
      template: {
        platform: "google",
        systemPrompt:
          "You are an expert Google Ads copywriter specialized in creating high-converting ad copy that follows Google's character limits and policies.",
        sections: googleSections,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✅ Created Google Ads default template");
  } else {
    console.log("⏭️  Google Ads default template already exists");
  }

  // TikTok Default Template
  const tiktokTemplateId = nanoid();
  const tiktokSections = [
    {
      id: "intro",
      name: "Introduction",
      content: `You are an expert TikTok ad copywriter. Create engaging, trendy TikTok ad copy that resonates with TikTok's young, dynamic audience.

PROJECT: {projectName}

TASK: Create TikTok ad copy with:
1. Caption (engaging, conversational)
2. Hashtags (relevant, trending)

VARIATION TYPE: {variationType}`,
      editable: true,
      required: true,
      order: 1,
    },
    {
      id: "rules",
      name: "TikTok Style Guide",
      content: `TIKTOK BEST PRACTICES:
- Use casual, conversational language
- Include trending phrases and slang
- Keep it authentic and relatable
- Use relevant hashtags (5-10 max)
- Include a clear call-to-action
- Appeal to emotions and trends`,
      editable: true,
      required: true,
      order: 2,
    },
    {
      id: "assets",
      name: "Asset Context",
      content: `VISUAL/AUDIO ASSETS CONTEXT:
{assetInterpretations}`,
      editable: false,
      required: false,
      order: 3,
    },
    {
      id: "landing_pages",
      name: "Landing Page Content",
      content: `LANDING PAGE CONTENT:
{landingPageContent}`,
      editable: false,
      required: false,
      order: 4,
    },
    {
      id: "output_format",
      name: "Output Format",
      content: `OUTPUT FORMAT:
CAPTION: [Your engaging TikTok caption here]

HASHTAGS: [List of relevant hashtags separated by spaces]

Generate the TikTok ad copy now:`,
      editable: true,
      required: true,
      order: 5,
    },
  ];

  // Check if TikTok template already exists
  const existingTikTokTemplate = existingTemplates.filter(
    (t) => t.template.platform === "tiktok"
  );

  if (existingTikTokTemplate.length === 0) {
    await db.insert(promptTemplate).values({
      id: tiktokTemplateId,
      userId: firstUserId,
      name: "Default TikTok Template",
      promptType: "ad_copy",
      isDefault: "true",
      template: {
        platform: "tiktok",
        systemPrompt:
          "You are an expert TikTok ad copywriter specialized in creating engaging, trendy ad copy that resonates with TikTok's audience.",
        sections: tiktokSections,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✅ Created TikTok default template");
  } else {
    console.log("⏭️  TikTok default template already exists");
  }

  console.log("🎉 Prompt template seeding completed!");
}

async function main() {
  try {
    await seedPromptTemplates();
    console.log("✅ Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

main();
