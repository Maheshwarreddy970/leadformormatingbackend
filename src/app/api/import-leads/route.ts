// src/app/api/import-leads/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60; // Max execution timeout
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { offset = 0, batchSize = 100 } = await req.json();

    const filePath = path.join(process.cwd(), "src", "data", "push.json");
    const rawData = await fs.readFile(filePath, "utf-8");
    const leads: any[] = JSON.parse(rawData);

    // 1. STRICTER IN-MEMORY DEDUPLICATION
    // We only deduplicate if PlaceID is identical. 
    // We allow shared websites/phones since franchises often share them.
    const uniqueLeadsMap = new Map();
    let noPlaceIdCounter = 0;

    for (const item of leads) {
      const placeId = item.PlaceID?.trim();
      
      // If PlaceID exists, use it to deduplicate. If not, generate a unique key so it doesn't get merged.
      const fingerprint = placeId ? `place_${placeId}` : `unknown_${noPlaceIdCounter++}`;
      
      if (!uniqueLeadsMap.has(fingerprint)) {
        uniqueLeadsMap.set(fingerprint, item);
      }
    }

    const deduplicatedLeads = Array.from(uniqueLeadsMap.values());
    const totalLeads = deduplicatedLeads.length;

    // 2. GET THE CURRENT CHUNK
    const chunk = deduplicatedLeads.slice(offset, offset + batchSize);
    
    if (chunk.length === 0) {
      return NextResponse.json({ success: true, processed: 0, hasMore: false, total: totalLeads });
    }

    // 3. CLEAN & FORMAT DATA
    const cleanNumber = (val: any) => {
      if (typeof val === "number") return isNaN(val) ? null : val;
      if (!val || typeof val !== "string" || val.trim() === "") return null;
      const parsed = Number(val);
      return isNaN(parsed) ? null : parsed;
    };

    const cleanString = (val: any) => {
      if (!val || typeof val !== "string" || val.trim() === "") return null;
      return val.trim();
    };

    const formattedChunk = chunk.map((item) => {
      return {
        name: cleanString(item.Name) || "Unknown Lead",
        phone: cleanString(item.Phone),
        email: cleanString(item.Email),
        website: cleanString(item.Website),
        address: cleanString(item.Address),
        instagram: cleanString(item.Instagram),
        facebook: cleanString(item.Facebook),
        twitter: cleanString(item.Twitter),
        linkedin: cleanString(item.Linkedin),
        yelp: cleanString(item.Yelp),
        youtube: cleanString(item.Youtube),
        placeId: cleanString(item.PlaceID) || null,
        cid: item.CID ? String(item.CID) : null,
        category: cleanString(item.Category),
        reviewCount: cleanNumber(item.ReviewCount) ? Math.round(cleanNumber(item.ReviewCount)!) : null,
        averageRating: cleanNumber(item.AverageRating),
        latitude: cleanNumber(item.Latitude),
        longitude: cleanNumber(item.Longitude),
        extractedEmail: cleanString(item["extracted emails"]),
        extractedFacebook: cleanString(item["extracted facebook"]),
      };
    });

    // 4. DATABASE INGESTION
    await Promise.all(
      formattedChunk.map(async (lead) => {
        if (lead.placeId) {
          return prisma.lead.upsert({
            where: { placeId: lead.placeId },
            update: lead,
            create: lead,
          });
        }
        return prisma.lead.create({ data: lead });
      })
    );

    const hasMore = offset + batchSize < totalLeads;

    return NextResponse.json({ 
      success: true, 
      processed: chunk.length, 
      hasMore, 
      total: totalLeads 
    });

  } catch (error: any) {
    console.error("API Import Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}