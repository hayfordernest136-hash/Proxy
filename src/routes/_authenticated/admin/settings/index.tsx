import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SITE_SETTINGS, readSiteSettings, writeSiteSettings, type SiteSettings } from "@/lib/site-settings";

export const Route = createFileRoute("/_authenticated/admin/settings/")({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSettings(readSiteSettings());
  }, []);

  function updateField(field: keyof SiteSettings, value: string) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      writeSiteSettings(settings);
      toast.success("Site settings saved");
    } catch {
      toast.error("Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Settings</p>
        <h1 className="text-3xl font-bold tracking-tight">System configuration</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Site branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="siteName">Site name</Label>
              <Input
                id="siteName"
                value={settings.siteName}
                onChange={(event) => updateField("siteName", event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="siteTagline">Tagline</Label>
              <Textarea
                id="siteTagline"
                value={settings.siteTagline}
                onChange={(event) => updateField("siteTagline", event.target.value)}
              />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="whatsappNumber">WhatsApp number</Label>
                <Input
                  id="whatsappNumber"
                  value={settings.whatsappNumber}
                  onChange={(event) => updateField("whatsappNumber", event.target.value)}
                  placeholder="233501234567"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="defaultCurrency">Default currency</Label>
                <Input
                  id="defaultCurrency"
                  value={settings.defaultCurrency}
                  onChange={(event) => updateField("defaultCurrency", event.target.value.toUpperCase())}
                  maxLength={3}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Branding</p>
              <p>{settings.siteName}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Tagline</p>
              <p>{settings.siteTagline}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Default currency</p>
              <p>{settings.defaultCurrency}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
