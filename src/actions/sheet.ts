// src/app/actions/sheet.ts
"use server";

import { prisma } from "@/lib/prisma";

export async function getSheetData() {
  // Fetch all leads. Since it's for an admin sheet, we return everything at once.
  return prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function updateSheetCell(id: string, field: string, value: any) {
  try {
    let finalValue = value;

    // Handle empty strings as nulls for optional fields
    if (value === "") {
      finalValue = null;
    } 
    // Handle Numbers
    else if (["reviewCount", "averageRating", "latitude", "longitude"].includes(field)) {
      finalValue = Number(value);
      if (isNaN(finalValue)) return { success: false, error: "Invalid number format" };
    } 
    // Handle Booleans
    else if (["isExtracted", "isWebsiteWorking", "viewedLink", "viewedWebsite"].includes(field)) {
      finalValue = value === "true" || value === true;
    } 
    // Handle Dates
    else if (["emailSent1", "emailSent2", "emailSent3"].includes(field)) {
      finalValue = value ? new Date(value) : null;
    }

    await prisma.lead.update({
      where: { id },
      data: { [field]: finalValue },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}