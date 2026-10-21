import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { DigitalProduct, LicenseTierId } from '../src/data/products';
import { LICENSE_OPTIONS } from '../src/data/products';

export async function generateProtectedBundlePdf(
  product: DigitalProduct,
  orderId: string,
  customerEmail: string,
  licenseTier: LicenseTierId
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${product.name} — Two Kids Design`);
  pdfDoc.setAuthor('Two Kids Design Studio');
  pdfDoc.setSubject(`Licensed Digital PDF Bundle (${orderId})`);
  pdfDoc.setKeywords(['Two Kids Design', 'PDF Bundle', product.category, orderId]);

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const license = LICENSE_OPTIONS[licenseTier] || LICENSE_OPTIONS.personal;

  // Cover & Licence Certificate Page
  const coverPage = pdfDoc.addPage([612, 792]); // US Letter (8.5" x 11")
  const { width, height } = coverPage.getSize();

  // Warm Ivory Background
  coverPage.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.98, 0.972, 0.953),
  });

  // Top Brand Header Bar
  coverPage.drawRectangle({
    x: 40,
    y: height - 95,
    width: width - 80,
    height: 55,
    color: rgb(0.125, 0.125, 0.125),
  });

  coverPage.drawText('TWO KIDS DESIGN · OFFICIAL DIGITAL PDF BUNDLE', {
    x: 60,
    y: height - 72,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Sky Blue Accent Bar (matching logo's signature cyan)
  coverPage.drawRectangle({
    x: 40,
    y: height - 101,
    width: 140,
    height: 6,
    color: rgb(0.22, 0.64, 0.84),
  });

  // Bundle Title & Metadata
  coverPage.drawText(product.name, {
    x: 40,
    y: height - 145,
    size: 18,
    font: fontBold,
    color: rgb(0.125, 0.125, 0.125),
  });

  coverPage.drawText(
    `Category: ${product.category}   |   Verified Bundle Size: ${product.verifiedPageCount} Pages (${product.verifiedFileCount} Files)`,
    {
      x: 40,
      y: height - 170,
      size: 10,
      font: fontRegular,
      color: rgb(0.35, 0.35, 0.35),
    }
  );

  // Licence Certificate Box
  coverPage.drawRectangle({
    x: 40,
    y: height - 340,
    width: width - 80,
    height: 145,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.22, 0.64, 0.84),
    borderWidth: 1.5,
  });

  coverPage.drawText('VERIFIED ORDER & LICENCE CERTIFICATE (LIPILA VERIFIED)', {
    x: 60,
    y: height - 222,
    size: 11,
    font: fontBold,
    color: rgb(0.22, 0.64, 0.84),
  });

  const certLines = [
    `Order Reference: ${orderId}`,
    `Licensed To: ${customerEmail}`,
    `Selected Licence Tier: ${license.name}`,
    `Currency & Settlement: Zambian Kwacha (ZMW)`,
    `Issued Timestamp: ${new Date().toISOString()}`,
    `Summary: ${license.summary}`,
  ];

  certLines.forEach((line, idx) => {
    coverPage.drawText(line.slice(0, 92), {
      x: 60,
      y: height - 245 - idx * 16,
      size: 9,
      font: fontRegular,
      color: rgb(0.15, 0.15, 0.15),
    });
  });

  // Included Files Manifest Section
  coverPage.drawText('INCLUDED FILES & DESIGN SHEETS IN THIS BUNDLE:', {
    x: 40,
    y: height - 375,
    size: 12,
    font: fontBold,
    color: rgb(0.125, 0.125, 0.125),
  });

  product.includedFiles.forEach((file, index) => {
    const yPos = height - 405 - index * 48;
    coverPage.drawRectangle({
      x: 40,
      y: yPos - 26,
      width: width - 80,
      height: 40,
      color: rgb(0.95, 0.94, 0.92),
    });
    coverPage.drawText(`${index + 1}. ${file.filename} (${file.pageCount} pages)`, {
      x: 52,
      y: yPos - 6,
      size: 10,
      font: fontBold,
      color: rgb(0.125, 0.125, 0.125),
    });
    coverPage.drawText(file.description.slice(0, 95), {
      x: 52,
      y: yPos - 20,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    });
  });

  // Footer
  coverPage.drawText(
    'At Two Kids Design, we create fun and professionally crafted digital products for crafters, entrepreneurs, and POD businesses.',
    {
      x: 40,
      y: 45,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    }
  );

  // Add Sample Printable Art / Design Sheets for each preview sheet in the product
  const allSheets = [product.coverPreview, ...product.samplePages];
  for (let i = 0; i < allSheets.length; i++) {
    const sheet = allSheets[i];
    const page = pdfDoc.addPage([612, 792]);

    // Clean White Printable Sheet Canvas with crop marks
    page.drawRectangle({
      x: 36,
      y: 36,
      width: width - 72,
      height: height - 72,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1,
    });

    // Header band
    page.drawText(`TWO KIDS DESIGN · ${sheet.pageNumber.toUpperCase()}`, {
      x: 56,
      y: height - 68,
      size: 9,
      font: fontBold,
      color: rgb(0.22, 0.64, 0.84),
    });

    page.drawText(sheet.title, {
      x: 56,
      y: height - 92,
      size: 16,
      font: fontBold,
      color: rgb(0.125, 0.125, 0.125),
    });

    page.drawText(sheet.subtitle, {
      x: 56,
      y: height - 110,
      size: 10,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Draw 2x2 Printable Design Motif Cards on the sheet
    sheet.sampleElements.forEach((elementName, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cardX = 56 + col * 255;
      const cardY = height - 350 - row * 240;

      page.drawRectangle({
        x: cardX,
        y: cardY,
        width: 235,
        height: 210,
        color: rgb(0.985, 0.98, 0.965),
        borderColor: rgb(0.125, 0.125, 0.125),
        borderWidth: 1.2,
      });

      // Decorative geometric emblem inside each printable cutout
      page.drawCircle({
        x: cardX + 117.5,
        y: cardY + 125,
        size: 42,
        color: rgb(0.22, 0.64, 0.84),
      });

      page.drawText(elementName.toUpperCase(), {
        x: cardX + 24,
        y: cardY + 52,
        size: 11,
        font: fontBold,
        color: rgb(0.125, 0.125, 0.125),
      });

      page.drawText(`Print-Ready Motif #0${idx + 1} · Cut Line Margin`, {
        x: cardX + 24,
        y: cardY + 34,
        size: 8,
        font: fontRegular,
        color: rgb(0.45, 0.45, 0.45),
      });
    });

    page.drawText(
      `Licensed Order: ${orderId} (${customerEmail}) — Page ${i + 2} of ${allSheets.length + 1}`,
      {
        x: 56,
        y: 52,
        size: 8,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5),
      }
    );
  }

  return await pdfDoc.save();
}
