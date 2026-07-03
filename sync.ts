import { scrapers } from "./scrapers/mod.ts";
import { Post } from "./types.ts";

interface PostWithContent extends Post {
  content?: string;
}

// Cleanup orphaned images that are no longer referenced in any active post content
async function cleanupOrphanedImages(posts: PostWithContent[]) {
  console.log("\n🧹 Cleaning up orphaned images...");
  try {
    const activeImages = new Set<string>();

    for (const post of posts) {
      if (post.content) {
        // Find any references like "images/abcdef123.jpg" or similar
        const matches = post.content.match(
          /images\/[a-f0-9]+\.(jpg|jpeg|png|webp|gif)/g,
        );
        if (matches) {
          for (const match of matches) {
            const filename = match.split("/")[1];
            activeImages.add(filename);
          }
        }
      }
    }

    console.log(`Active referenced images: ${activeImages.size}`);

    try {
      let filesCount = 0;
      let deletedCount = 0;

      for await (const entry of Deno.readDir("./images")) {
        if (entry.isFile) {
          filesCount++;
          if (!activeImages.has(entry.name)) {
            await Deno.remove(`./images/${entry.name}`);
            deletedCount++;
          }
        }
      }
      console.log(
        `Total images checked: ${filesCount}, Deleted: ${deletedCount}`,
      );
    } catch (readErr) {
      if (readErr instanceof Deno.errors.NotFound) {
        console.log("No images folder found, skipping cleanup.");
      } else {
        throw readErr;
      }
    }
  } catch (err) {
    console.error("❌ Error during image cleanup:", err);
  }
}

let DATA_FILE_PATH = "./data.json";
let META_FILE_PATH = "./sync_meta.json";
const MAX_POSTS_PER_SOURCE = 50;

async function loadExistingPosts(): Promise<PostWithContent[]> {
  try {
    const text = await Deno.readTextFile(DATA_FILE_PATH);
    return JSON.parse(text) as PostWithContent[];
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      console.log(`No existing ${DATA_FILE_PATH} found. Starting fresh.`);
      return [];
    }
    console.error(`Error reading existing ${DATA_FILE_PATH}, starting fresh:`, err);
    return [];
  }
}

async function savePosts(posts: PostWithContent[]) {
  console.log(`Saving ${posts.length} posts to ${DATA_FILE_PATH}...`);
  await Deno.writeTextFile(DATA_FILE_PATH, JSON.stringify(posts, null, 2));

  // Save sync metadata
  const meta = {
    updatedAt: Date.now(),
  };
  await Deno.writeTextFile(META_FILE_PATH, JSON.stringify(meta, null, 2));
  console.log("Save complete!");
}

// Helper to determine remote origin URL and GITHUB_TOKEN if available
async function getGitRemoteUrl(): Promise<string> {
  let remoteUrl = "";
  try {
    const command = new Deno.Command("git", {
      args: ["remote", "get-url", "origin"],
    });
    const { success, stdout } = await command.output();
    if (success) {
      remoteUrl = new TextDecoder().decode(stdout).trim();
    }
  } catch (_) {
    // ignore
  }

  const token = Deno.env.get("GITHUB_TOKEN");
  if (token && remoteUrl) {
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^.]+)/);
    if (match) {
      return `https://x-access-token:${token}@github.com/${match[1]}/${match[2]}.git`;
    }
  }
  return remoteUrl;
}

async function runSync() {
  console.log("=========================================");
  console.log("🔄 Starting Cozy Archiver Sync...");
  console.log("=========================================");

  DATA_FILE_PATH = "./data_branch/data.json";
  META_FILE_PATH = "./data_branch/sync_meta.json";

  const isCI = Deno.env.get("GITHUB_ACTIONS") === "true";
  const remoteUrl = await getGitRemoteUrl();

  // Ensure data_branch exists and is synced with remote
  try {
    const hasDataBranch = await Deno.stat("./data_branch").then(() => true).catch(() => false);
    if (!hasDataBranch) {
      console.log("Cloning remote 'data' branch...");
      const cloneCmd = new Deno.Command("git", {
        args: ["clone", "--branch", "data", remoteUrl, "./data_branch"],
      });
      const { success } = await cloneCmd.output();
      if (!success) {
        console.log("Failed to clone 'data' branch (may not exist yet). Initializing empty repository...");
        await Deno.mkdir("./data_branch", { recursive: true });
        
        const gitInit = new Deno.Command("git", { args: ["init"], cwd: "./data_branch" });
        await gitInit.output();
        const gitCheckout = new Deno.Command("git", { args: ["checkout", "-b", "data"], cwd: "./data_branch" });
        await gitCheckout.output();
        if (remoteUrl) {
          const gitRemote = new Deno.Command("git", { 
            args: ["remote", "add", "origin", remoteUrl], 
            cwd: "./data_branch" 
          });
          await gitRemote.output();
        }
      }
    } else {
      console.log("Pulling latest updates for 'data' branch...");
      const pullCmd = new Deno.Command("git", {
        args: ["pull", "origin", "data"],
        cwd: "./data_branch",
      });
      const { success } = await pullCmd.output();
      if (!success) {
        console.warn("Git pull failed. Proceeding with existing local cache.");
      }
    }
  } catch (err) {
    console.error("Error preparing data branch:", err);
    await Deno.mkdir("./data_branch", { recursive: true });
  }

  // Ensure images branch exists and is synced with remote
  try {
    const hasImagesBranch = await Deno.stat("./images").then(() => true).catch(() => false);
    if (!hasImagesBranch) {
      console.log("Cloning remote 'images' branch...");
      const cloneCmd = new Deno.Command("git", {
        args: ["clone", "--branch", "images", remoteUrl, "./images"],
      });
      const { success } = await cloneCmd.output();
      if (!success) {
        console.log("Failed to clone 'images' branch (may not exist yet). Initializing empty repository...");
        await Deno.mkdir("./images", { recursive: true });
        
        const gitInit = new Deno.Command("git", { args: ["init"], cwd: "./images" });
        await gitInit.output();
        const gitCheckout = new Deno.Command("git", { args: ["checkout", "-b", "images"], cwd: "./images" });
        await gitCheckout.output();
        if (remoteUrl) {
          const gitRemote = new Deno.Command("git", { 
            args: ["remote", "add", "origin", remoteUrl], 
            cwd: "./images" 
          });
          await gitRemote.output();
        }
      }
    } else {
      console.log("Pulling latest updates for 'images' branch...");
      const pullCmd = new Deno.Command("git", {
        args: ["pull", "origin", "images"],
        cwd: "./images",
      });
      const { success } = await pullCmd.output();
      if (!success) {
        console.warn("Git pull for images failed. Proceeding with existing local cache.");
      }
    }
  } catch (err) {
    console.error("Error preparing images branch:", err);
    await Deno.mkdir("./images", { recursive: true });
  }

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

  // 4. Cleanup orphaned images
  await cleanupOrphanedImages(limitedPosts);

  // 5. Save back to data.json
  await savePosts(limitedPosts);

  console.log("Deploying data to data branch...");
  try {
    const git = async (...args: string[]) => {
      const cmd = new Deno.Command("git", {
        args,
        cwd: "./data_branch",
      });
      const { success, stderr } = await cmd.output();
      if (!success) {
        console.error(`Git command failed: git ${args.join(" ")}`);
        console.error(new TextDecoder().decode(stderr));
      }
      return success;
    };

    const hasGit = await Deno.stat("./data_branch/.git").then(() => true).catch(() => false);
    if (hasGit) {
      if (isCI) {
        await git("config", "user.name", "github-actions[bot]");
        await git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
      }

      await git("add", "data.json", "sync_meta.json");
      
      const diffCmd = new Deno.Command("git", {
        args: ["diff", "--cached", "--quiet"],
        cwd: "./data_branch",
      });
      const { success: noChanges } = await diffCmd.output();

      if (noChanges) {
        console.log("No data changes to commit.");
      } else {
        await git("commit", "-m", "chore: auto-update news feeds");
        
        if (isCI && remoteUrl) {
          await git("remote", "set-url", "origin", remoteUrl);
        }
        
        await git("push", "origin", "data", "--force");
        console.log("Successfully pushed data changes to data branch!");
      }
    }
  } catch (err) {
    console.error("Error pushing data changes to data branch:", err);
  }

  console.log("Deploying images to images branch...");
  try {
    const git = async (...args: string[]) => {
      const cmd = new Deno.Command("git", {
        args,
        cwd: "./images",
      });
      const { success, stderr } = await cmd.output();
      if (!success) {
        console.error(`Git command failed: git ${args.join(" ")}`);
        console.error(new TextDecoder().decode(stderr));
      }
      return success;
    };

    const hasGit = await Deno.stat("./images/.git").then(() => true).catch(() => false);
    if (hasGit) {
      if (isCI) {
        await git("config", "user.name", "github-actions[bot]");
        await git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
      }

      await git("add", ".");
      
      const diffCmd = new Deno.Command("git", {
        args: ["diff", "--cached", "--quiet"],
        cwd: "./images",
      });
      const { success: noChanges } = await diffCmd.output();

      if (noChanges) {
        console.log("No image changes to commit.");
      } else {
        await git("commit", "-m", "chore: auto-sync active images");
        
        if (isCI && remoteUrl) {
          await git("remote", "set-url", "origin", remoteUrl);
        }
        
        await git("push", "origin", "images", "--force");
        console.log("Successfully pushed images to images branch!");
      }
    }
  } catch (err) {
    console.error("Error pushing images to images branch:", err);
  }

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
