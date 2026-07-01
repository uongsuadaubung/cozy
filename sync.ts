import { scrapers } from "./scrapers/mod.ts";
import { Post } from "./types.ts";

interface PostWithContent extends Post {
  content?: string;
}

const DATA_FILE_PATH = "./data.json";
const MAX_POSTS_PER_SOURCE = 50;

async function loadExistingPosts(): Promise<PostWithContent[]> {
  try {
    const text = await Deno.readTextFile(DATA_FILE_PATH);
    return JSON.parse(text) as PostWithContent[];
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      console.log("No existing data.json found. Starting fresh.");
      return [];
    }
    console.error("Error reading existing data.json, starting fresh:", err);
    return [];
  }
}

async function savePosts(posts: PostWithContent[]) {
  console.log(`Saving ${posts.length} posts to ${DATA_FILE_PATH}...`);
  await Deno.writeTextFile(DATA_FILE_PATH, JSON.stringify(posts, null, 2));
  console.log("Save complete!");
}

async function runSync() {
  console.log("=========================================");
  console.log("🔄 Starting Cozy Archiver Sync...");
  console.log("=========================================");

  // Parse arguments
  const filterSource = Deno.args.filter((arg) => !arg.startsWith("-"))[0];
  const forceRecrawl = Deno.args.includes("--force") ||
    Deno.args.includes("-f");

  const activeScrapers = filterSource
    ? scrapers.filter((s) =>
      s.source.toLowerCase() === filterSource.toLowerCase() ||
      s.source.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() ===
        filterSource.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
    )
    : scrapers;

  if (filterSource && activeScrapers.length === 0) {
    console.log(
      `⚠️ Warning: No scraper found matching "${filterSource}". Running all scrapers.`,
    );
  }

  const scrapersToRun = (filterSource && activeScrapers.length > 0)
    ? activeScrapers
    : scrapers;

  // 1. Load existing posts
  const existingPosts = await loadExistingPosts();
  console.log(`Loaded ${existingPosts.length} existing posts.`);

  // Create a map of existing posts by ID for fast lookup
  const postsMap = new Map<string, PostWithContent>();
  for (const post of existingPosts) {
    postsMap.set(post.id, post);
  }

  // Track counts
  let newPostsCount = 0;
  let errorCount = 0;

  // 2. Run scrapers
  for (const scraper of scrapersToRun) {
    console.log(`\n📡 Scraping source: ${scraper.source}...`);
    try {
      const allScrapedPosts = await scraper.fetchPosts();
      console.log(
        `Found ${allScrapedPosts.length} articles on front page of ${scraper.source}.`,
      );

      // Chỉ giữ lại tối đa 50 tin mới nhất để xử lý, tránh fetch nội dung của các tin cũ thừa
      const scrapedPosts = allScrapedPosts.slice(0, MAX_POSTS_PER_SOURCE);
      if (allScrapedPosts.length > MAX_POSTS_PER_SOURCE) {
        console.log(
          `   [INFO] Sliced scraped list from ${allScrapedPosts.length} to ${MAX_POSTS_PER_SOURCE} newest posts.`,
        );
      }

      for (const scrapedPost of scrapedPosts) {
        // If post already exists, has valid content (not a placeholder), and we are not forcing a recrawl, keep it
        const existing = postsMap.get(scrapedPost.id);
        const hasValidContent = existing &&
          existing.content &&
          !existing.content.includes("Nội dung bài viết chưa được cào");

        if (existing && hasValidContent && !forceRecrawl) {
          // Update details if they changed, but keep content and original creation time
          postsMap.set(scrapedPost.id, {
            ...scrapedPost,
            createdAt: existing.createdAt, // Giữ nguyên thời gian đăng bài gốc
            content: existing.content,
          });
          continue;
        }

        // New post or forced recrawl! Fetch detail content
        console.log(`   [FETCH] Fetching content for: "${scrapedPost.title}"`);
        try {
          // Wait slightly to avoid rate-limiting
          await new Promise((resolve) => setTimeout(resolve, 500));

          const content = await scraper.fetchContent(scrapedPost.url);
          const postWithContent: PostWithContent = {
            ...scrapedPost,
            content: content || "<p>Nội dung bài viết chưa được cào.</p>",
          };
          postsMap.set(scrapedPost.id, postWithContent);
          newPostsCount++;
        } catch (contentErr) {
          console.error(
            `   ❌ Failed to fetch content for ${scrapedPost.url}:`,
            contentErr,
          );
          // Save with the uniform placeholder so we will try to crawl it again on next run
          postsMap.set(scrapedPost.id, {
            ...scrapedPost,
            content: "<p>Nội dung bài viết chưa được cào.</p>",
          });
          newPostsCount++; // Count as new since we added it to map
        }
      }
      console.log(`✅ Completed sync for ${scraper.source}.`);
    } catch (scraperErr) {
      console.error(`❌ Error scraping ${scraper.source}:`, scraperErr);
      errorCount++;
    }
  }

  // 3. Process, group and enforce limit per source
  console.log("\n-----------------------------------------");
  console.log("Processing and sorting posts...");
  const allPosts = Array.from(postsMap.values());

  // Group by source
  const groupedBySource = new Map<string, PostWithContent[]>();
  for (const post of allPosts) {
    if (!groupedBySource.has(post.source)) {
      groupedBySource.set(post.source, []);
    }
    groupedBySource.get(post.source)!.push(post);
  }

  // Sort each group and limit to MAX_POSTS_PER_SOURCE
  const limitedPosts: PostWithContent[] = [];
  for (const [source, sourcePosts] of groupedBySource.entries()) {
    // Sort descending by createdAt
    sourcePosts.sort((a, b) => b.createdAt - a.createdAt);

    // Slice to limit
    const sliced = sourcePosts.slice(0, MAX_POSTS_PER_SOURCE);
    limitedPosts.push(...sliced);

    const diff = sourcePosts.length - sliced.length;
    if (diff > 0) {
      console.log(`🧹 Pruned ${diff} older posts for source: ${source}`);
    }
  }

  // Sort final array by createdAt desc
  limitedPosts.sort((a, b) => b.createdAt - a.createdAt);

  // 4. Save back to data.json
  await savePosts(limitedPosts);

  console.log("=========================================");
  console.log(`Cozy Sync Finished!`);
  console.log(`- New posts added: ${newPostsCount}`);
  console.log(`- Scrapers failed: ${errorCount}`);
  console.log(`- Total posts in database: ${limitedPosts.length}`);
  console.log("=========================================");
}

if (import.meta.main) {
  await runSync();
}
