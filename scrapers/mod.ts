import { OmgUbuntuScraper } from "./omg_ubuntu.ts";
import { HackerNewsScraper } from "./hacker_news.ts";
import { GenKScraper } from "./genk.ts";
import { BluefinScraper } from "./bluefin.ts";
import { System76Scraper } from "./system76.ts";
import { WindowsLatestScraper } from "./windowslatest.ts";
import { OmgLinuxScraper } from "./omglinux.ts";
import { WindowsCentralScraper } from "./windowscentral.ts";
import { TinhteScraper } from "./tinhte.ts";
import { VnReviewScraper } from "./vnreview.ts";
import { TechZScraper } from "./techz.ts";
import { TechRumScraper } from "./techrum.ts";
import { Scraper } from "../types.ts";

// Danh sách toàn bộ các Scraper sẽ được kích hoạt cào tin tức
export const scrapers: Scraper[] = [
  new OmgUbuntuScraper(),
  new HackerNewsScraper(),
  new GenKScraper(),
  new BluefinScraper(),
  new System76Scraper(),
  new WindowsLatestScraper(),
  new OmgLinuxScraper(),
  new WindowsCentralScraper(),
  new TinhteScraper(),
  new VnReviewScraper(),
  new TechZScraper(),
  new TechRumScraper(),
];
