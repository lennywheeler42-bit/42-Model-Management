import Image from "next/image";

// The agency's logo, from 42modelmanagement.com (light versions in public/brand; the
// original SVG is 740 KB). Its last line is white, so "full" is for dark backgrounds
// only. "mark" (42 and FORTY TWO) reads on any background.
const FILES = {
  full: { src: "/brand/logo-full-960.webp", width: 960, height: 530 },
  fullSmall: { src: "/brand/logo-full-320.webp", width: 320, height: 177 },
  mark: { src: "/brand/logo-mark-480.webp", width: 480, height: 215 },
  markSmall: { src: "/brand/logo-mark-160.webp", width: 160, height: 72 },
};

export function BrandLogo({ variant, className, alt = "", priority = false }: { variant: keyof typeof FILES; className?: string; alt?: string; priority?: boolean }) {
  return <Image {...FILES[variant]} alt={alt} className={className} priority={priority} unoptimized />;
}
