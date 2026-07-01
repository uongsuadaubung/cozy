import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

function parseRelativeTime(text: string): number {
  const now = Date.now();
  const cleanText = text.toLowerCase().trim();

  if (cleanText.includes("phút trước")) {
    const match = cleanText.match(/(\d+)/);
    if (match) {
      return now - parseInt(match[1], 10) * 60 * 1000;
    }
  } else if (cleanText.includes("giờ trước")) {
    const match = cleanText.match(/(\d+)/);
    if (match) {
      return now - parseInt(match[1], 10) * 60 * 60 * 1000;
    }
  } else if (cleanText.includes("ngày trước")) {
    const match = cleanText.match(/(\d+)/);
    if (match) {
      return now - parseInt(match[1], 10) * 24 * 60 * 60 * 1000;
    }
  } else if (cleanText.includes("vừa xong") || cleanText.includes("mới đăng")) {
    return now;
  }

  const dateParsed = Date.parse(cleanText);
  if (!isNaN(dateParsed)) {
    return dateParsed;
  }

  return now;
}

export class TechZScraper implements Scraper {
  source = "TechZ" as const;

  async fetchPosts(): Promise<Post[]> {
    const posts: Post[] = [];
    let overallIndex = 0;

    for (let page = 1; page <= 3; page++) {
      try {
        let html = "";
        if (page === 1) {
          const url = "https://www.techz.vn/tin-moi-nhat.html";
          const response = await fetch(url, {
            headers: COMMON_HEADERS,
          });

          if (!response.ok) {
            console.warn(
              `[TechZ] Failed to fetch page 1: Status ${response.status}`,
            );
            continue;
          }
          html = await response.text();
        } else {
          const url = "https://www.techz.vn/ver-2/moinhat-more";
          const response = await fetch(url, {
            method: "POST",
            headers: {
              ...COMMON_HEADERS,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `page=${page}`,
          });

          if (!response.ok) {
            console.warn(
              `[TechZ] Failed to fetch page ${page} from API: Status ${response.status}`,
            );
            continue;
          }

          const jsonText = await response.text();
          try {
            html = JSON.parse(jsonText);
          } catch (jsonErr) {
            console.warn(
              `[TechZ] Failed to parse JSON response for page ${page}:`,
              jsonErr,
            );
            continue;
          }
        }

        const $ = cheerio.load(html);

        // For page 1, select inside #moinhat_content. For subsequent pages, select directly from the root list
        const cardsSelector = page === 1
          ? "#moinhat_content .card-info"
          : ".card-info";
        const cards = $(cardsSelector);

        cards.each((_, element) => {
          const $el = $(element);
          const titleLink = $el.find(".card-info-title a").first();
          const href = titleLink.attr("href");

          if (!href) return;

          const title = titleLink.text().trim();
          if (!title) return;

          const postUrl = href.startsWith("http")
            ? href
            : `https://www.techz.vn${href}`;

          // Extract ID from slug like ylt699367.html
          const idMatch = postUrl.match(/-ylt(\d+)\.html$/);
          const id = idMatch
            ? `techz-${idMatch[1]}`
            : `techz-${encodeURIComponent(postUrl).slice(-20)}`;

          // Extract category/author
          const author =
            $el.find(".card-info-body .text-primary-1 a").first().text()
              .trim() || "TechZ";

          // Extract created time
          const timeText = $el.find(".card-info-body span.text-meta").last()
            .text().trim();
          const baseTime = timeText ? parseRelativeTime(timeText) : Date.now();

          // Maintain order by subtracting index offset
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
        console.error(`[TechZ] Error scraping page ${page}:`, err);
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

    const contentEl = $(".entry-body").first();

    if (!contentEl.length) {
      return "Không tìm thấy nội dung bài viết.";
    }

    // Clean up advertisements, related links, source links and scripting
    contentEl.find(
      "script, style, iframe, ins, .adsbygoogle, .news-relation-top-detail, #original_link",
    ).remove();

    return contentEl.html() || "Nội dung bài viết trống.";
  }
}
