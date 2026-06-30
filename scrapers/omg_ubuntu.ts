import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

async function sha256(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function parseRelativeDate(dateText: string): number {
  const now = new Date();
  const text = dateText.trim().toLowerCase();

  if (!text) return 0;

  if (text.includes("hour") || text.includes("hr")) {
    const match = text.match(/(\d+)/);
    if (match) {
      const hours = parseInt(match[1]);
      now.setHours(now.getHours() - hours);
      return now.getTime();
    }
  }
  
  if (text.includes("minute") || text.includes("min")) {
    const match = text.match(/(\d+)/);
    if (match) {
      const mins = parseInt(match[1]);
      now.setMinutes(now.getMinutes() - mins);
      return now.getTime();
    }
  }

  if (text.includes("day")) {
    const match = text.match(/(\d+)/);
    if (match) {
      const days = parseInt(match[1]);
      now.setDate(now.getDate() - days);
      return now.getTime();
    }
  }

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const targetDayIndex = dayNames.indexOf(text);
  if (targetDayIndex !== -1) {
    const currentDayIndex = now.getDay();
    let diff = currentDayIndex - targetDayIndex;
    if (diff <= 0) {
      diff += 7;
    }
    now.setDate(now.getDate() - diff);
    now.setHours(12, 0, 0, 0);
    return now.getTime();
  }

  const parsed = Date.parse(dateText);
  if (!isNaN(parsed)) {
    return parsed;
  }

  return 0;
}

class ChallengedFetcher {
  cookies: Map<string, string> = new Map();

  private getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, val]) => `${name}=${val}`)
      .join("; ");
  }

  private saveCookies(response: Response) {
    const setCookies = typeof response.headers.getSetCookie === "function" 
      ? response.headers.getSetCookie() 
      : (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
      
    for (const cookie of setCookies) {
      const parts = cookie.split(";")[0].split("=");
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join("=").trim();
        this.cookies.set(name, value);
      }
    }
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers || {});
    for (const [key, value] of Object.entries(COMMON_HEADERS)) {
      headers.set(key, value);
    }
    
    if (this.cookies.size > 0) {
      headers.set("Cookie", this.getCookieHeader());
    }

    const fetchStartTime = Date.now();
    let response = await fetch(url, { ...options, headers });
    this.saveCookies(response);

    if (response.status === 403) {
      const html = await response.clone().text();
      if (html.includes("Checking your browser") || html.includes("X-Hashcash-Solution")) {
        const solved = await this.solveChallenge(url, html, fetchStartTime);
        if (solved) {
          headers.set("Cookie", this.getCookieHeader());
          response = await fetch(url, { ...options, headers });
          this.saveCookies(response);
        }
      }
    }

    return response;
  }

  private async solveChallenge(baseUrl: string, _html: string, fetchStartTime: number): Promise<boolean> {
    const rawHcc = this.cookies.get("_hcc");
    if (!rawHcc) return false;
    const parts = rawHcc.split(":");
    if (parts.length < 2) return false;
    const eStr = atob(parts[1]);
    const r = eStr.split("|");
    const t = parseInt(r[3]) || 0;
    const n = r[4] || "";
    const o = t >= 2;

    let solution = "";
    for (let nonce = 0; nonce < 200000000; nonce++) {
      const candidate = eStr + nonce;
      const hash = await sha256(candidate);
      if (hash.startsWith("0000")) {
        solution = candidate;
        break;
      }
    }

    if (!solution) return false;

    // Yêu cầu thời gian tối thiểu 3.5 giây từ lúc bắt đầu request để vượt qua bộ lọc bot
    const elapsed = Date.now() - fetchStartTime;
    if (elapsed < 4000) {
      const waitTime = 4000 - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const challengeUrl = new URL("/__challenge", baseUrl).toString();
    const originUrl = new URL("/", baseUrl).toString();

    const postHeaders = new Headers();
    postHeaders.set("User-Agent", COMMON_HEADERS["User-Agent"]);
    postHeaders.set("Accept", "*/*");
    postHeaders.set("Cookie", this.getCookieHeader());
    postHeaders.set("X-Hashcash-Solution", btoa(solution));
    postHeaders.set("X-Interactive", o ? n : "");
    postHeaders.set("Referer", baseUrl);
    postHeaders.set("Origin", originUrl.substring(0, originUrl.length - 1));
    postHeaders.set("Content-Length", "0");

    const postRes = await fetch(challengeUrl, {
      method: "POST",
      headers: postHeaders
    });

    this.saveCookies(postRes);
    return postRes.ok;
  }
}

export class OmgUbuntuScraper implements Scraper {
  source = "OmgUbuntu" as const;
  private client = new ChallengedFetcher();

  async fetchPosts(): Promise<Post[]> {
    const pages = [1];
    const posts: Post[] = [];
    let globalIndex = 0;

    for (const page of pages) {
      const url = `https://www.omgubuntu.co.uk/page/${page}`;
      try {
        const response = await this.client.fetch(url);
        if (!response.ok) {
          console.error(`Failed to fetch OMG! Ubuntu! Page ${page}: Status ${response.status}`);
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const hasBgContainer = $(".homepage-layout__bg-container").length > 0;
        const selector = hasBgContainer 
          ? ".homepage-layout__bg-container a.layout__title-link" 
          : "a.layout__title-link";

        $(selector).each((_, element) => {
          const $el = $(element);
          const postUrl = $el.attr("href");

          if (!postUrl) return;

          const title = $el.find(".portholes-layout__title").text().trim() 
                     || $el.find("h3.layout__title").text().trim() 
                     || $el.text().trim();
                     
          const summary = $el.find(".portholes-layout__subtitle").text().trim();

          const idMatch = postUrl.match(/\/([^\/]+)\/?$/);
          const id = idMatch ? `omg-${idMatch[1]}` : `omg-${encodeURIComponent(postUrl).slice(-20)}`;

          // Tìm ngày đăng bài từ class .layout__date nếu có
          let foundDateText = "";
          const wrapper = $el.closest(".tile-layout__item, .portholes-layout__item, .mosaic-tile");
          if (wrapper.length) {
            const dateEl = wrapper.find(".layout__date").first();
            if (dateEl.length) {
              foundDateText = dateEl.text().trim();
            }
          }

          let baseTime = 0;
          if (foundDateText) {
            baseTime = parseRelativeDate(foundDateText);
          }
          
          // Nếu không tìm thấy hoặc không parse được ngày chi tiết, dựa vào URL lấy ra năm và tháng
          if (!baseTime) {
            const dateMatch = postUrl.match(/\/(\d{4})\/(\d{2})\//);
            if (dateMatch) {
              const year = parseInt(dateMatch[1]);
              const month = parseInt(dateMatch[2]);
              baseTime = new Date(year, month - 1, 1).getTime();
            } else {
              baseTime = Date.now();
            }
          }

          // Trừ đi globalIndex (phút) để giữ nguyên thứ tự xuất hiện gốc nếu các bài viết trùng ngày/tháng
          const createdAt = baseTime - (globalIndex * 60 * 1000);
          globalIndex++;

          // Tránh trùng lặp bài viết giữa các trang
          if (!posts.some(p => p.id === id)) {
            posts.push({
              id,
              title,
              url: postUrl,
              source: this.source,
              author: "OMG! Ubuntu!",
              createdAt,
              summary: summary || undefined
            });
          }
        });
      } catch (err) {
        console.error(`Error crawling page ${page}:`, err);
      }
    }

    return posts;
  }

  async fetchContent(url: string): Promise<string> {
    const response = await this.client.fetch(url);

    if (!response.ok) {
      throw new Error(`Không thể tải bài viết: Mã lỗi ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const contentEl = $(".entry-content, .post-content").first();

    if (!contentEl.length) {
      return "Không tìm thấy thẻ chứa nội dung bài viết.";
    }

    contentEl.find(".sharedaddy, .wpcnt, .author-bio, script, style, iframe").remove();
    
    // Loại bỏ khung đăng ký email quảng cáo Jetpack và các form đăng ký email
    contentEl.find(".wp-block-jetpack-subscriptions, .wp-block-jetpack-subscriptions__container, .jetpack-subscribe-feed, form.subscribe-form").remove();
    
    // Tìm các form chứa email input và xóa sạch form/div bao quanh
    contentEl.find("input[type='email'], input[name='email']").closest("form, div, section").remove();
    
    // Xóa các dòng text liên quan đến Subscribe
    contentEl.find("h3:contains('Discover more from'), h2:contains('Discover more from'), h4:contains('Discover more from'), p:contains('Discover more from')").remove();
    contentEl.find("p:contains('Subscribe to get'), p:contains('sent to your email'), p:contains('Type your email')").remove();

    return contentEl.html() || "Nội dung bài viết trống.";
  }
}
