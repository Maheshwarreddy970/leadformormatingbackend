// src/app/actions/sheet.ts
"use server";

import { prisma } from "@/lib/prisma";

export async function getSheetData() {
  return prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
}

export async function updateSheetCell(id: string, field: string, value: any) {
  try {
    let finalValue = formatValue(field, value);
    if (finalValue === undefined) return { success: false, error: "Invalid format" };

    await prisma.lead.update({
      where: { id },
      data: { [field]: finalValue },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function bulkUpdateSheetCells(ids: string[], field: string, value: any) {
  try {
    let finalValue = formatValue(field, value);
    if (finalValue === undefined) return { success: false, error: "Invalid format" };

    await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: { [field]: finalValue },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function formatValue(field: string, value: any) {
  if (value === "") return null;
  if (["reviewCount", "averageRating", "latitude", "longitude"].includes(field)) {
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }
  if (["isExtracted", "isWebsiteWorking", "viewedLink", "viewedWebsite"].includes(field)) {
    return value === "true" || value === true;
  }
  if (["emailSent1", "emailSent2", "emailSent3"].includes(field)) {
    return value ? new Date(value) : null;
  }
  return value;
}