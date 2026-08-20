// src/app/api/extractemailfacebookurlfromwebsite/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const FB_REGEX = /https?:\/\/(?:www\.)?(?:facebook\.com|fb\.com)\/[a-zA-Z0-9._%-]+/gi;
const JUNK_DOMAINS = ["wixpress.com", "sentry.io", "example.com", "wix.com", "domain.com", "weebly.com"];
const JUNK_PREFIXES = ["noreply", "no-reply", "donotreply", "admin", "postmaster", "mailer-daemon"];
const JUNK_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".css", ".js"];
const INVALID_FB_PATHS = ["/sharer", "/share", "/pages/create", "/help", "/policies", "/login", "/dialog"];

async function fetchPage(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" },
      redirect: "follow",
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

function validateAndRankEmails(rawEmails: string[], baseDomain: string) {
  const uniqueEmails = Array.from(new Set(rawEmails.map((e) => e.toLowerCase())));
  const validEmails = uniqueEmails.filter((email) => {
    const [prefix, domain] = email.split("@");
    if (!domain || !prefix) return false;
    if (JUNK_EXTENSIONS.some((ext) => email.endsWith(ext))) return false;
    if (JUNK_DOMAINS.some((junk) => domain.includes(junk))) return false;
    if (JUNK_PREFIXES.some((junk) => prefix === junk)) return false;
    return true;
  });

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

function validateFacebook(rawUrls: string[]) {
  const uniqueUrls = Array.from(new Set(rawUrls.map(u => u.toLowerCase().replace(/\/$/, ""))));
  return uniqueUrls.filter(url => {
    try {
      const parsed = new URL(url);
      if (INVALID_FB_PATHS.some(path => parsed.pathname.startsWith(path))) return false;
      if (parsed.pathname === "/" || parsed.pathname === "") return false;
      return true;
    } catch {
      return false;
    }
  });
}

async function magicScrape(targetUrl: string) {
  let formattedUrl = targetUrl.trim();
  if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = `https://${formattedUrl}`;
  let baseUrl: URL;
  try {
    baseUrl = new URL(formattedUrl);
  } catch {
    throw new Error("Invalid URL format");
  }

  const homeHtml = await fetchPage(formattedUrl);
  if (!homeHtml) throw new Error("Website unreachable");

  const $ = cheerio.load(homeHtml);
  let aggregateHtml = homeHtml;
  const subpagesToVisit = new Set<string>();
  
  // Scrape mailto: explicitly from the homepage
  const extractedMailtos: string[] = [];
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) extractedMailtos.push(href.replace('mailto:', '').split('?')[0].trim());
  });
  
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const lowerText = $(el).text().toLowerCase();
    const lowerHref = href.toLowerCase();
    if (lowerText.includes("contact") || lowerText.includes("about") || lowerHref.includes("contact") || lowerHref.includes("about")) {
      try {
        const resolvedUrl = new URL(href, baseUrl.href).href;
        if (new URL(resolvedUrl).hostname === baseUrl.hostname) subpagesToVisit.add(resolvedUrl);
      } catch {}
    }
  });

  if (subpagesToVisit.size === 0) {
    subpagesToVisit.add(new URL("/contact", baseUrl.href).href);
    subpagesToVisit.add(new URL("/contact-us", baseUrl.href).href);
  }

  const urlsToFetch = Array.from(subpagesToVisit).slice(0, 2);
  const subpageHtmls = await Promise.all(urlsToFetch.map(url => fetchPage(url, 6000)));
  
  subpageHtmls.forEach(html => {
    if (html) {
      aggregateHtml += ` ${html}`;
      const sub$ = cheerio.load(html);
      sub$('a[href^="mailto:"]').each((_, el) => {
        const href = sub$(el).attr('href');
        if (href) extractedMailtos.push(href.replace('mailto:', '').split('?')[0].trim());
      });
    }
  });

  const rawEmails = [...(aggregateHtml.match(EMAIL_REGEX) || []), ...extractedMailtos];
  const rawFacebook = aggregateHtml.match(FB_REGEX) || [];

  const finalEmails = validateAndRankEmails(rawEmails, baseUrl.hostname);
  const finalFacebook = validateFacebook(rawFacebook);

  return {
    extractedEmail: finalEmails.length > 0 ? finalEmails.join(", ") : null,
    extractedFacebook: finalFacebook.length > 0 ? finalFacebook.join(", ") : null,
  };
}

// ... Keep your existing POST and GET functions here exactly as they were (batchSize = 8)

export async function POST() {
  try {
    // Increased to 8 because we are now running them in parallel!
    const batchSize = 8; 
    
    const leads = await prisma.lead.findMany({
      where: { isExtracted: false },
      take: batchSize,
    });

    if (leads.length === 0) {
      return NextResponse.json({ message: "Completed", remaining: 0, logs: [] });
    }

    // Process all 8 leads AT THE SAME TIME using Promise.all
    const logs = await Promise.all(
      leads.map(async (lead) => {
        if (!lead.website || lead.website.trim() === "") {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { isExtracted: true, isWebsiteWorking: false, websiteError: "No URL" },
          });
          return { name: lead.name, status: "Ignored (No URL)" };
        }

        try {
          // The magicScrape runs concurrently for all leads
          const { extractedEmail, extractedFacebook } = await magicScrape(lead.website);

          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              isExtracted: true,
              isWebsiteWorking: true,
              websiteError: null,
              extractedEmail: extractedEmail || lead.extractedEmail,
              extractedFacebook: extractedFacebook || lead.extractedFacebook,
            },
          });

          return {
            name: lead.name,
            status: "Success",
            email: extractedEmail || "None",
            fb: extractedFacebook || "None",
          };
        } catch (err: any) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              isExtracted: true,
              isWebsiteWorking: false,
              websiteError: (err.message || "Failed").slice(0, 255),
            },
          });
          return { name: lead.name, status: `Failed: ${err.message}` };
        }
      })
    );

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