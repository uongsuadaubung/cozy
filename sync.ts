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
    console.error(
      `Error reading existing ${DATA_FILE_PATH}, starting fresh:`,
      err,
    );
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
      return `https://x-access-token:${token}@github.com/${match[1]}/${
        match[2]
      }.git`;
    }
  }
  return remoteUrl;
}

// Helper to prepare Git branches (handles cloning, fetching, pulling and in-place initialization)
async function prepareGitBranch(
  dir: string,
  branch: string,
  remoteUrl: string,
) {
  try {
    const hasGit = await Deno.stat(`${dir}/.git`).then(() => true).catch(() =>
      false
    );
    if (hasGit) {
      console.log(`Pulling latest updates for '${branch}' branch in ${dir}...`);
      const pullCmd = new Deno.Command("git", {
        args: ["pull", "origin", branch],
        cwd: dir,
      });
      const { success } = await pullCmd.output();
      if (!success) {
        console.warn(
          `Git pull for ${branch} failed in ${dir}. Proceeding with existing local cache.`,
        );
      }
      return;
    }

    const hasDir = await Deno.stat(dir).then(() => true).catch(() => false);
    if (!hasDir) {
      console.log(`Cloning remote '${branch}' branch into ${dir}...`);
      const cloneCmd = new Deno.Command("git", {
        args: ["clone", "--branch", branch, remoteUrl, dir],
      });
      const { success } = await cloneCmd.output();
      if (success) return;
    }

    // Initialize in-place if directory exists or clone failed
    console.log(
      `Initializing Git repository in ${dir} for '${branch}' branch...`,
    );
    await Deno.mkdir(dir, { recursive: true });

    const git = async (...args: string[]) => {
      const cmd = new Deno.Command("git", { args, cwd: dir });
      const { success, stderr } = await cmd.output();
      if (!success) {
        console.warn(`Git command failed in ${dir}: git ${args.join(" ")}`);
        console.warn(new TextDecoder().decode(stderr));
      }
      return success;
    };

    await git("init");
    await git("checkout", "-b", branch);
    if (remoteUrl) {
      await git("remote", "add", "origin", remoteUrl);
      console.log(`Fetching remote '${branch}' branch in ${dir}...`);
      await git("fetch", "origin", branch);
      await git("reset", "--mixed", `origin/${branch}`);
    }
  } catch (err) {
    console.error(`Error preparing branch ${branch} in ${dir}:`, err);
    await Deno.mkdir(dir, { recursive: true });
  }
}

// Helper to push Git branch with squashed history (exactly 1 commit on the remote branch)
async function pushGitBranch(
  dir: string,
  branch: string,
  message: string,
  isCI: boolean,
  remoteUrl: string,
) {
  console.log(`Deploying ${branch} to ${branch} branch...`);
  try {
    const git = async (...args: string[]) => {
      const cmd = new Deno.Command("git", {
        args,
        cwd: dir,
      });
      const { success, stderr } = await cmd.output();
      if (!success) {
        console.error(`Git command failed in ${dir}: git ${args.join(" ")}`);
        console.error(new TextDecoder().decode(stderr));
      }
      return success;
    };

    const hasGit = await Deno.stat(`${dir}/.git`).then(() => true).catch(() =>
      false
    );
    if (!hasGit) {
      console.warn(`No Git repository found in ${dir}. Skipping push.`);
      return;
    }

    if (isCI) {
      await git("config", "user.name", "github-actions[bot]");
      await git(
        "config",
        "user.email",
        "41898282+github-actions[bot]@users.noreply.github.com",
      );
    }

    await git("add", ".");

    // Check if there are changes
    const diffCmd = new Deno.Command("git", {
      args: ["diff", "--cached", "--quiet"],
      cwd: dir,
    });
    const { success: noChanges } = await diffCmd.output();

    if (noChanges) {
      console.log(`No changes to commit for ${branch}.`);
      return;
    }

    // Squash history into a single commit by creating an orphan branch
    console.log(`Squashing history for ${branch} branch...`);
    await git("checkout", "--orphan", "temp_branch");
    await git("commit", "-m", message);
    await git("branch", "-M", branch);

    if (isCI && remoteUrl) {
      await git("remote", "set-url", "origin", remoteUrl);
    }

    console.log(`Force-pushing ${branch} branch to remote...`);
    const pushSuccess = await git("push", "origin", branch, "--force");
    if (pushSuccess) {
      console.log(`Successfully pushed ${branch} branch to remote!`);
    }
  } catch (err) {
    console.error(`Error pushing ${branch} branch:`, err);
  }
}

async function runSync() {
  console.log("=========================================");
  console.log("🔄 Starting Cozy Archiver Sync...");
  console.log("=========================================");

  DATA_FILE_PATH = "./data_branch/data.json";
  META_FILE_PATH = "./data_branch/sync_meta.json";

  const isCI = Deno.env.get("GITHUB_ACTIONS") === "true";
  const remoteUrl = await getGitRemoteUrl();

  // Prepare data branch
  await prepareGitBranch("./data_branch", "data", remoteUrl);

  // Prepare images branch
  await prepareGitBranch("./images", "images", remoteUrl);

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

  // Deploy data
  await pushGitBranch(
    "./data_branch",
    "data",
    "chore: auto-update news feeds",
    isCI,
    remoteUrl,
  );

  // Deploy images
  await pushGitBranch(
    "./images",
    "images",
    "chore: auto-sync active images",
    isCI,
    remoteUrl,
  );

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
