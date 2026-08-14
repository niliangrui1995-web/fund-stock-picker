export const appPages = ["research", "leverage", "methodology"] as const;

export type AppPage = (typeof appPages)[number];

const pagePaths: Record<AppPage, string> = {
  research: "/research",
  leverage: "/leverage",
  methodology: "/methodology",
};

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

export function appPagePath(page: AppPage) {
  return pagePaths[page];
}

export function pageFromPathname(pathname: string): AppPage {
  const normalized = normalizePathname(pathname);
  return (Object.entries(pagePaths).find(([, path]) => path === normalized)?.[0] as AppPage | undefined) ?? "research";
}

export function pageFromLegacyHash(hash: string): AppPage | null {
  const value = hash.replace(/^#/, "");
  return appPages.includes(value as AppPage) ? (value as AppPage) : null;
}
