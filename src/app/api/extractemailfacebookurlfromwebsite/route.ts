// src/app/api/extractemailfacebookurlfromwebsite/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";

export const maxDuration = 60; // Max timeout for Vercel
export const dynamic = "force-dynamic";

// Regex Definitions
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const FB_REGEX = /https?:\/\/(?:www\.)?(?:facebook\.com|fb\.com)\/[a-zA-Z0-9._%-]+/gi;

// Validation Blocklists
const JUNK_DOMAINS = ["wixpress.com", "sentry.io", "example.com", "wix.com", "domain.com", "weebly.com"];
const JUNK_PREFIXES = ["noreply", "no-reply", "donotreply", "admin", "postmaster", "mailer-daemon"];
const JUNK_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".css", ".js"];
const INVALID_FB_PATHS = ["/sharer", "/share", "/pages/create", "/help", "/policies", "/login", "/dialog"];

/**
 * Fetch a URL with an abort timeout
 */
async function fetchPage(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0" },
      redirect: "follow",
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.text();
  } catch (error) {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Validate and Score Emails
 * 1. Exact domain match (e.g., info@15thstreetpetgrooming.com) -> Score 2
 * 2. Standard free emails (e.g., grooming@gmail.com) -> Score 1
 */
function validateAndRankEmails(rawEmails: string[], baseDomain: string) {
  const uniqueEmails = Array.from(new Set(rawEmails.map((e) => e.toLowerCase())));
  
  const validEmails = uniqueEmails.filter((email) => {
    const [prefix, domain] = email.split("@");
    if (!domain || !prefix) return false;
    
    // Filter out images mapped as emails and obvious junk
    if (JUNK_EXTENSIONS.some((ext) => email.endsWith(ext))) return false;
    if (JUNK_DOMAINS.some((junk) => domain.includes(junk))) return false;
    if (JUNK_PREFIXES.some((junk) => prefix === junk)) return false;
    
    return true;
  });

  // Sort by relevance (Domain match first, then Gmail/Yahoo, then others)
  return validEmails.sort((a, b) => {
    const domainA = a.split("@")[1];
    const domainB = b.split("@")[1];
    const baseClean = baseDomain.replace("www.", "");
    
    const isDomainA = domainA.includes(baseClean);
    const isDomainB = domainB.includes(baseClean);
    
    if (isDomainA && !isDomainB) return -1;
    if (!isDomainA && isDomainB) return 1;
    return 0;
  });
}

/**
 * Validate Facebook URLs
 */
function validateFacebook(rawUrls: string[]) {
  const uniqueUrls = Array.from(new Set(rawUrls.map(u => u.toLowerCase().replace(/\/$/, ""))));
  
  return uniqueUrls.filter(url => {
    try {
      const parsed = new URL(url);
      // Ensure it's not a sharing link or system page
      if (INVALID_FB_PATHS.some(path => parsed.pathname.startsWith(path))) return false;
      if (parsed.pathname === "/" || parsed.pathname === "") return false;
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * The "Magic" Deep Scraper
 */
async function magicScrape(targetUrl: string) {
  let formattedUrl = targetUrl.trim();
  if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = `https://${formattedUrl}`;
  
  let baseUrl: URL;
  try {
    baseUrl = new URL(formattedUrl);
  } catch {
    throw new Error("Invalid URL format");
  }

  // 1. Fetch Homepage
  const homeHtml = await fetchPage(formattedUrl);
  if (!homeHtml) throw new Error("Website unreachable");

  const $ = cheerio.load(homeHtml);
  let aggregateHtml = homeHtml;

  // 2. Find Contact/About Pages automatically
  const subpagesToVisit = new Set<string>();
  
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    
    const lowerText = $(el).text().toLowerCase();
    const lowerHref = href.toLowerCase();
    
    // If link text or URL contains contact keywords
    if (
      lowerText.includes("contact") || lowerText.includes("about") || 
      lowerHref.includes("contact") || lowerHref.includes("about")
    ) {
      try {
        // Resolve relative links (e.g., "/contact-us" -> "https://domain.com/contact-us")
        const resolvedUrl = new URL(href, baseUrl.href).href;
        // Ensure we stay on the same domain
        if (new URL(resolvedUrl).hostname === baseUrl.hostname) {
          subpagesToVisit.add(resolvedUrl);
        }
      } catch {
        // Ignore invalid URLs
      }
    }
  });

  // Fallbacks if no links found in DOM
  if (subpagesToVisit.size === 0) {
    subpagesToVisit.add(new URL("/contact", baseUrl.href).href);
    subpagesToVisit.add(new URL("/contact-us", baseUrl.href).href);
  }

  // 3. Fetch up to 2 subpages concurrently to save time
  const urlsToFetch = Array.from(subpagesToVisit).slice(0, 2);
  const subpageHtmls = await Promise.all(urlsToFetch.map(url => fetchPage(url, 6000)));
  
  subpageHtmls.forEach(html => {
    if (html) aggregateHtml += ` ${html}`; // Combine text
  });

  // 4. Extract and Validate
  const rawEmails = aggregateHtml.match(EMAIL_REGEX) || [];
  const rawFacebook = aggregateHtml.match(FB_REGEX) || [];

  const finalEmails = validateAndRankEmails(rawEmails, baseUrl.hostname);
  const finalFacebook = validateFacebook(rawFacebook);

  return {
    extractedEmail: finalEmails.length > 0 ? finalEmails.join(", ") : null,
    extractedFacebook: finalFacebook.length > 0 ? finalFacebook.join(", ") : null,
  };
}

export async function POST() {
  try {
    // Process smaller batch sizes (5) because deep crawling takes longer
    const batchSize = 2; 
    const leads = await prisma.lead.findMany({
      where: { isExtracted: false },
      take: batchSize,
    });

    if (leads.length === 0) {
      return NextResponse.json({ message: "Completed", remaining: 0, logs: [] });
    }

    const logs: Array<{ name: string; status: string; email?: string; fb?: string }> = [];

    for (const lead of leads) {
      if (!lead.website || lead.website.trim() === "") {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { isExtracted: true, isWebsiteWorking: false, websiteError: "No URL" },
        });
        logs.push({ name: lead.name, status: "Ignored (No URL)" });
        continue;
      }

      try {
        const { extractedEmail, extractedFacebook } = await magicScrape(lead.website);

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            isExtracted: true,
            isWebsiteWorking: true,
            websiteError: null,
            // Only overwrite if we actually found something, otherwise keep existing DB data
            extractedEmail: extractedEmail || lead.extractedEmail,
            extractedFacebook: extractedFacebook || lead.extractedFacebook,
          },
        });

        logs.push({
          name: lead.name,
          status: "Success",
          email: extractedEmail || "None",
          fb: extractedFacebook || "None",
        });
      } catch (err: any) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            isExtracted: true,
            isWebsiteWorking: false,
            websiteError: (err.message || "Failed").slice(0, 255),
          },
        });
        logs.push({ name: lead.name, status: `Failed: ${err.message}` });
      }
    }

    const remaining = await prisma.lead.count({ where: { isExtracted: false } });
    return NextResponse.json({ success: true, processed: leads.length, remaining, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const [total, extracted, working, broken, pending] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { isExtracted: true } }),
    prisma.lead.count({ where: { isWebsiteWorking: true } }),
    prisma.lead.count({ where: { isWebsiteWorking: false } }),
    prisma.lead.count({ where: { isExtracted: false } }),
  ]);

  return NextResponse.json({ total, extracted, working, broken, pending });
}