import React, { useEffect, useRef } from 'react';
import { LiquidGlassContainer } from '../lib/liquidGlass';

interface LiquidGlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  variant?: 'nav' | 'control' | 'surface' | 'pill';
  type?: 'rounded' | 'circle' | 'pill';
  borderRadius?: number;
  className?: string;
  enableWebGL?: boolean;
}

export const LiquidGlassSurface: React.FC<LiquidGlassSurfaceProps> = ({
  children,
  variant = 'surface',
  type = 'rounded',
  borderRadius = 16,
  className = '',
  enableWebGL = false,
  ...rest
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<LiquidGlassContainer | null>(null);

  useEffect(() => {
    // Only attempt WebGL attachment if explicitly enabled, window has WebGL, and user does not prefer reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!enableWebGL || prefersReducedMotion || !containerRef.current) return;

    try {
      const container = new LiquidGlassContainer({
        type,
        borderRadius,
        tintOpacity: 0.08,
      });
      instanceRef.current = container;

      if (container.element && containerRef.current) {
        containerRef.current.appendChild(container.element);
      }
    } catch {
      // Graceful fallback to CSS liquid-glass styling
    }

    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, [enableWebGL, type, borderRadius]);

  const variantClass =
    variant === 'nav'
      ? 'liquid-glass-nav'
      : variant === 'control'
      ? 'liquid-glass-control'
      : variant === 'pill'
      ? 'liquid-glass-pill'
      : 'liquid-glass-surface';

  return (
    <div
      ref={containerRef}
      className={`relative ${variantClass} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};
