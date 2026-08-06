import Image from "next/image";
import Link from "next/link";

type BrandMarkProps = {
  href?: string;
  size?: "sm" | "md" | "lg" | "hero";
  showWordmark?: boolean;
  className?: string;
};

const sizeMap = {
  sm: { width: 32, height: 22 },
  md: { width: 44, height: 30 },
  lg: { width: 72, height: 50 },
  hero: { width: 160, height: 110 },
} as const;

export function BrandMark({
  href = "/",
  size = "md",
  showWordmark = false,
  className = "",
}: BrandMarkProps) {
  const dims = sizeMap[size];

  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/feezy-logo.png"
        alt="Feezypay"
        width={dims.width}
        height={dims.height}
        priority={size === "hero" || size === "lg"}
        className="object-contain"
      />
      {showWordmark ? (
        <span className="font-display text-lg font-semibold tracking-tight text-foreground">
          Feezypay
        </span>
      ) : null}
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="inline-flex items-center outline-none">
      {content}
    </Link>
  );
}
