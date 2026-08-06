import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-full flex-1 flex-col bg-background">
      {children}
    </main>
  );
}

export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-medium text-feezy-coral underline-offset-4 transition hover:text-foreground hover:underline"
    >
      {children}
    </Link>
  );
}
