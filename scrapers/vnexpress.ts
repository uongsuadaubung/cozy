import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";

import { COMMON_HEADERS } from "./constants.ts";

export class VnExpressScraper implements Scraper {
  source = "VnExpress" as const;

  async fetchPosts(): Promise<Post[]> {
    const posts: Post[] = [];
    let overallIndex = 0;
    let lastKnownTime = Date.now();

    for (let page = 1; page <= 3; page++) {
      const url = `https://vnexpress.net/tin-tuc-24h-p${page}`;
      try {
        const response = await fetch(url, {
          headers: COMMON_HEADERS,
        });

        if (!response.ok) {
          console.warn(
            `[VnExpress] Failed to fetch page ${page}: Status ${response.status}`,
          );
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const container = $("div.width_common.list-news-subfolder");
        const articles = container.find("article.item-news.item-news-common.thumb-left");

        articles.each((_, element) => {
          const $el = $(element);
          const titleLink = $el.find("h3.title-news a").first();
          const href = titleLink.attr("href");

          if (!href) return;

          const title = titleLink.text().trim() || titleLink.attr("title") || "";
          if (!title) return;

          const summary = $el.find("p.description").text().trim();

          const postUrl = href.startsWith("http")
            ? href
            : `https://vnexpress.net${href}`;

          // Extract ID from URL
          const idMatch = postUrl.match(/-(\d+)\.html/);
          const id = idMatch
            ? `vnexpress-${idMatch[1]}`
            : `vnexpress-${encodeURIComponent(postUrl).slice(-20)}`;

          // Extract created time
          const timeEl = $el.find(".time-ago").first();
          const datetimeAttr = timeEl.attr("datetime");

          let baseTime = lastKnownTime;
          if (datetimeAttr) {
            const isoStr = datetimeAttr.replace(" ", "T") + "+07:00";
            const parsedTime = Date.parse(isoStr);
            if (!isNaN(parsedTime)) {
              baseTime = parsedTime;
              lastKnownTime = parsedTime;
            }
          } else {
            // Decrement slightly for items with missing timestamps to maintain order
            baseTime = lastKnownTime - 5 * 60 * 1000;
            lastKnownTime = baseTime;
          }

          // Index-based minor adjustment to avoid identical timestamps and preserve exact list ordering
          const createdAt = baseTime - (overallIndex * 1000);
          overallIndex++;

          posts.push({
            id,
            title,
            url: postUrl,
            source: this.source,
            author: "VnExpress",
            createdAt,
            summary: summary || undefined,
          });
        });
      } catch (err) {
        console.error(`[VnExpress] Error scraping page ${page}:`, err);
      }
    }

    return posts;
  }

  async fetchContent(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: COMMON_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Không thể tải bài viết VnExpress: Mã lỗi ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // VnExpress content is in .fck_detail (e.g. section.fck_detail or article.fck_detail)
    const contentEl = $(".fck_detail");

    if (!contentEl.length) {
      return "Không tìm thấy thẻ chứa nội dung bài viết.";
    }

    // Clean up unnecessary elements
    contentEl.find(
      "script, style, iframe, .ad-wrapper, .ad-position, .link-content-footer, .cf-monitor",
    ).remove();
    
    // Remove the title/description elements if nested inside .fck_detail to prevent double rendering in UI
    contentEl.find(
      ".title-detail, .description, .box-tinlienquan, .banner-ads, .insert-link-news",
    ).remove();

    let contentHtml = "";
    contentEl.each((_, el) => {
      contentHtml += $(el).html() || "";
    });

    return contentHtml.trim() || "Nội dung bài viết trống.";
  }
}
