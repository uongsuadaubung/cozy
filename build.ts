async function build() {
  console.log("=========================================");
  console.log("🛠️ Cozy Feed Deno Native Builder");
  console.log("=========================================");

  // 1. Ensure dist folder exists
  await Deno.mkdir("./dist", { recursive: true });

  // 2. Run Deno bundle command
  console.log("Bundling src/main.tsx using Deno native bundler...");
  const command = new Deno.Command("deno", {
    args: ["bundle", "--minify", "src/main.tsx", "-o", "dist/client.js"],
  });

  const { success, code, stderr } = await command.output();
  if (!success) {
    console.error(`Bundling failed with exit code: ${code}`);
    console.error(new TextDecoder().decode(stderr));
    Deno.exit(1);
  }

  // 3. Copy src/index.html to dist/index.html
  console.log("Copying src/index.html to dist/index.html...");
  const html = await Deno.readTextFile("src/index.html");
  await Deno.writeTextFile("dist/index.html", html);

  // 4. Copy src/style.css to dist/client.css
  console.log("Copying src/style.css to dist/client.css...");
  const css = await Deno.readTextFile("src/style.css");
  await Deno.writeTextFile("dist/client.css", css);
  const isGitHubActions = Deno.env.get("GITHUB_ACTIONS") === "true";

  if (isGitHubActions) {
    console.log("Skipping copying JSON files to dist/ because build is running in GitHub Actions.");
  } else {
    // 5. Copy data.json to dist/data.json
    try {
      console.log("Copying data.json to dist/data.json...");
      const dataJson = await Deno.readTextFile("data.json");
      await Deno.writeTextFile("dist/data.json", dataJson);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        console.log("No data.json found at root to copy, skipping.");
      } else {
        throw err;
      }
    }

    // Copy sync_meta.json to dist/sync_meta.json
    try {
      console.log("Copying sync_meta.json to dist/sync_meta.json...");
      const syncMeta = await Deno.readTextFile("sync_meta.json");
      await Deno.writeTextFile("dist/sync_meta.json", syncMeta);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        console.log("No sync_meta.json found at root to copy, skipping.");
      } else {
        throw err;
      }
    }

    // 6. Copy sources.json to dist/sources.json
    try {
      console.log("Copying sources.json to dist/sources.json...");
      const sourcesJson = await Deno.readTextFile("sources.json");
      await Deno.writeTextFile("dist/sources.json", sourcesJson);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        console.log("No sources.json found at root to copy, skipping.");
      } else {
        throw err;
      }
    }
  }

  console.log("\n✅ Deno Native Build completed successfully!");
  console.log("- dist/index.html (Copied)");
  console.log("- dist/client.js  (Bundled)");
  console.log("- dist/client.css (Compiled from style.css)");
  console.log("=========================================");
}

if (import.meta.main) {
  await build();
}
