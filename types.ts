export type NewsSource =
  | "HackerNews"
  | "OmgUbuntu"
  | "GenK"
  | "Bluefin"
  | "System76"
  | "WindowsLatest"
  | "OmgLinux"
  | "WindowsCentral"
  | "Tinhte"
  | "VnReview"
  | "TechZ"
  | "VnExpress"
  | "Dantri";

export interface Post {
  id: string; // ID duy nhất (ví dụ: "hn-12345" hoặc "omg-67890")
  title: string;
  url: string; // Link gốc của bài viết
  source: NewsSource;
  author: string;
  createdAt: number; // Timestamp (miliseconds) để sắp xếp tin mới nhất
  summary?: string; // Đoạn mô tả ngắn (nếu có)
}

export interface Scraper {
  source: NewsSource;
  fetchPosts(): Promise<Post[]>;
  fetchContent(url: string): Promise<string>;
}
