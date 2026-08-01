export type SiteSettings = {
  siteName: string;
  siteTagline: string;
  whatsappNumber: string;
  defaultCurrency: string;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: "BrokeFlex",
  siteTagline:
    "Premium residential, mobile and datacenter proxies delivered fast, with human support and local payment options.",
  whatsappNumber: (typeof import.meta !== "undefined" ? import.meta.env.VITE_WHATSAPP_NUMBER : undefined) ?? "",
  defaultCurrency: "GHS",
};

const STORAGE_KEY = "proxzone-site-settings";

export function readSiteSettings(): SiteSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SITE_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SITE_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<SiteSettings>;
    return {
      siteName: parsed.siteName?.trim() || DEFAULT_SITE_SETTINGS.siteName,
      siteTagline: parsed.siteTagline?.trim() || DEFAULT_SITE_SETTINGS.siteTagline,
      whatsappNumber: parsed.whatsappNumber?.trim() || DEFAULT_SITE_SETTINGS.whatsappNumber,
      defaultCurrency: parsed.defaultCurrency?.trim() || DEFAULT_SITE_SETTINGS.defaultCurrency,
    };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export function writeSiteSettings(settings: SiteSettings) {
  if (typeof window === "undefined") {
    return settings;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return settings;
}
