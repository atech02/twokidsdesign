import React from 'react';
import { FileText, Sparkles, CheckCircle2, Layers } from 'lucide-react';
import type { ProductPreviewSheet } from '../data/products';

interface PdfBundleSheetArtProps {
  sheet: ProductPreviewSheet;
  variant?: 'card' | 'detail' | 'hero';
  className?: string;
}

export const PdfBundleSheetArt: React.FC<PdfBundleSheetArtProps> = ({
  sheet,
  variant = 'card',
  className = '',
}) => {
  const isCompact = variant === 'card';

  return (
    <div
      className={`relative w-full overflow-hidden select-none border border-charcoal/10 transition-colors ${className}`}
      style={{ backgroundColor: sheet.accentColor || '#FAF8F3' }}
      role="img"
      aria-label={`PDF Bundle Preview: ${sheet.title} - ${sheet.subtitle}`}
    >
      {/* Subtle architectural dot pattern background */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#202020 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      />

      {/* Top PDF Format & Page Count Header Bar */}
      <div className="relative z-10 flex items-center justify-between px-3.5 pt-3.5 pb-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium tracking-wide text-charcoal shadow-sm border border-charcoal/10">
          <FileText className="w-3 h-3 text-brandBlue" />
          PDF BUNDLE
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-charcoal text-white px-2.5 py-1 text-[11px] font-medium tracking-wide">
          <Layers className="w-3 h-3 text-brandBlue" />
          {sheet.badgeText}
        </span>
      </div>

      {/* Main Layered Printable PDF Sheet Mockup */}
      <div className="relative z-10 px-4 pb-4 pt-1">
        {/* Back stacked page effect to communicate multi-page PDF bundle */}
        <div className="mx-auto w-[94%] h-2 rounded-t-md bg-white/70 border-t border-x border-charcoal/15 translate-y-0.5" />

        {/* Foreground Crisp Printable Sheet */}
        <div className="relative bg-white rounded-lg border border-charcoal/15 shadow-editorial p-3.5 sm:p-4">
          {/* Sheet Header Metadata */}
          <div className="flex items-center justify-between border-b border-softGrey pb-2 mb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-brandBlue-dark">
                TWO KIDS DESIGN · {sheet.pageNumber}
              </p>
              <h4
                className={`font-heading font-bold text-charcoal leading-tight mt-0.5 ${
                  isCompact ? 'text-xs sm:text-sm line-clamp-1' : 'text-sm sm:text-base'
                }`}
              >
                {sheet.title}
              </h4>
            </div>
            <span className="hidden sm:inline-flex items-center justify-center w-6 h-6 rounded-full bg-ivory border border-charcoal/10 text-[10px] font-bold text-charcoal">
              PDF
            </span>
          </div>

          {/* 2x2 Grid of Actual Design Elements / Motifs inside the PDF Sheet */}
          <div className="grid grid-cols-2 gap-2">
            {sheet.sampleElements.slice(0, 4).map((el, idx) => {
              const accents = [
                'bg-[#E3F3FA] border-[#38A3D6]/30',
                'bg-[#FAF8F3] border-charcoal/15',
                'bg-[#DCD4F2]/40 border-charcoal/15',
                'bg-[#F3E4A9]/45 border-charcoal/15',
              ];
              const badgeColor = accents[idx % accents.length];

              return (
                <div
                  key={el}
                  className={`rounded-md border p-2 flex flex-col justify-between transition-transform ${badgeColor} ${
                    isCompact ? 'min-h-[54px]' : 'min-h-[72px]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-charcoal/60">
                      0{idx + 1}
                    </span>
                    {sheet.illustrationType === 'planner-grid' ? (
                      <div className="flex gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-sm bg-brandBlue" />
                        <span className="w-1.5 h-1.5 rounded-sm bg-charcoal/30" />
                      </div>
                    ) : (
                      <Sparkles className="w-3 h-3 text-brandBlue-dark shrink-0" />
                    )}
                  </div>
                  <p className="font-heading font-semibold text-[11px] sm:text-xs text-charcoal leading-snug mt-1 line-clamp-1">
                    {el}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Bottom Print Crop Marks & Subtitle Bar */}
          <div className="mt-3 pt-2 border-t border-dashed border-charcoal/15 flex items-center justify-between text-[10px] text-charcoal/70">
            <span className="truncate pr-2">{sheet.subtitle}</span>
            <span className="inline-flex items-center gap-1 font-medium text-charcoal shrink-0">
              <CheckCircle2 className="w-3 h-3 text-brandBlue" />
              Print-Ready
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
