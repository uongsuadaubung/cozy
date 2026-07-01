import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

export class VnReviewScraper implements Scraper {
  source = "VnReview" as const;

  async fetchPosts(): Promise<Post[]> {
    const posts: Post[] = [];
    let overallIndex = 0;

    for (let page = 1; page <= 3; page++) {
      const url = `https://vnreview.vn/ewr-porta/page-${page}`;
      try {
        const response = await fetch(url, {
          headers: COMMON_HEADERS,
        });

        if (!response.ok) {
          console.warn(
            `[VnReview] Failed to fetch page ${page}: Status ${response.status}`,
          );
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        $(".porta-article-item.articles-main").each((_, element) => {
          const $el = $(element);
          const titleLink = $el.find(".block-header a").first();
          const href = titleLink.attr("href");

          if (!href) return;

          const title = titleLink.text().trim();
          if (!title) return;

          // Normalize relative URL to absolute URL
          const postUrl = href.startsWith("http")
            ? href
            : `https://vnreview.vn${href}`;

          // Extract unique ID from url (XenForo pattern matching last digit id)
          const idMatch = postUrl.match(/\.(\d+)\/?$/);
          const id = idMatch
            ? `vnreview-${idMatch[1]}`
            : `vnreview-${encodeURIComponent(postUrl).slice(-20)}`;

          // Extract author
          const author = $el.find(".author-block").first().text().trim() ||
            "VnReview";

          // Extract date
          const timeEl = $el.find("time.u-dt").first();
          const dataTime = timeEl.attr("data-time");
          let baseTime = 0;
          if (dataTime) {
            baseTime = parseInt(dataTime, 10) * 1000;
          } else {
            const datetimeAttr = timeEl.attr("datetime");
            baseTime = datetimeAttr ? Date.parse(datetimeAttr) : Date.now();
          }

          if (isNaN(baseTime) || !baseTime) {
            baseTime = Date.now();
          }

          // Subtract overallIndex * 1000 to keep relative order intact and stable
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
        console.error(`[VnReview] Error scraping page ${page}:`, err);
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

    // main content of xenforo first post is in .bbWrapper
    const contentEl = $(".bbWrapper").first();

    if (!contentEl.length) {
      return "Không tìm thấy nội dung bài viết.";
    }

    // Remove unwanted elements
    contentEl.find("script, style, iframe, .ad-wrapper, .adsbygoogle").remove();

    return contentEl.html() || "Nội dung bài viết trống.";
  }
}
