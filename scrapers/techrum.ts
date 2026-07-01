import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

export class TechRumScraper implements Scraper {
  source = "TechRum" as const;

  async fetchPosts(): Promise<Post[]> {
    const posts: Post[] = [];
    let overallIndex = 0;

    for (let page = 1; page <= 3; page++) {
      try {
        const url = `https://techrum.vn/articles/page-${page}`;
        const response = await fetch(url, {
          headers: COMMON_HEADERS,
        });

        if (!response.ok) {
          console.warn(
            `[TechRum] Failed to fetch page ${page}: Status ${response.status}`,
          );
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const items = $(".block.porta-masonry .porta-article-item");

        items.each((_, element) => {
          const $el = $(element);
          const titleLink = $el.find("h2.block-header a").first();
          const href = titleLink.attr("href");

          if (!href) return;

          const title = titleLink.text().trim();
          if (!title) return;

          const postUrl = href.startsWith("http")
            ? href
            : `https://techrum.vn${href}`;

          // Extract ID from url like /threads/...899488/
          const idMatch = postUrl.match(/\/threads\/[^.]+\.(\d+)\/?$/);
          const id = idMatch
            ? `techrum-${idMatch[1]}`
            : `techrum-${encodeURIComponent(postUrl).slice(-20)}`;

          // Extract author
          const author =
            $el.find(".message-attribution-main a.u-concealed").first().text()
              .trim() || "TechRum";

          // Extract created time
          const timeEl = $el.find("time.u-dt").first();
          const dataTime = timeEl.attr("data-time");
          let baseTime = Date.now();

          if (dataTime) {
            baseTime = parseInt(dataTime, 10) * 1000;
          } else {
            const datetimeAttr = timeEl.attr("datetime");
            if (datetimeAttr) {
              const parsed = Date.parse(datetimeAttr);
              if (!isNaN(parsed)) {
                baseTime = parsed;
              }
            }
          }

          // Maintain list ordering by subtracting a tiny index offset
          const createdAt = baseTime - (overallIndex * 1000);
          overallIndex++;

          posts.push({
            id,
            title,
            url: postUrl,
            source: this.source,
            author,
            createdAt,
          });
        });
      } catch (err) {
        console.error(`[TechRum] Error scraping page ${page}:`, err);
      }
    }

    return posts;
  }

  async fetchContent(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: COMMON_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Cannot load post content: Status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const contentEl = $(".message-body .bbWrapper").first();

    if (!contentEl.length) {
      return "Không tìm thấy nội dung bài viết.";
    }

    // Clean up advertisements and scripting
    contentEl.find("script, style, iframe, ins").remove();

    return contentEl.html() || "Nội dung bài viết trống.";
  }
}
