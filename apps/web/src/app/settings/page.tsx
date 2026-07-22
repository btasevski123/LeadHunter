'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

type SettingsResponse = {
  scraper: {
    enabledProviders: string[];
    requestDelayMs: number;
    maxRetries: number;
    timeoutMs: number;
    userAgent: string;
  };
  audit: {
    lightweight: boolean;
    concurrency: number;
    lighthouseTimeoutMs: number;
    captureScreenshots: boolean;
  };
  rateLimits: {
    httpMaxPerSecond: number;
    scrapeConcurrency: number;
  };
  export: {
    defaultFormat: 'CSV' | 'XLSX' | 'PDF';
    includeScreenshotsInPdf: boolean;
  };
  apiKeys: {
    openaiConfigured: boolean;
    dashboardApiKeyEnabled: boolean;
  };
  availableProviders: { id: string; name: string; industries: string[] }[];
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsResponse>('/settings'),
  });
  const [form, setForm] = useState<SettingsResponse | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: SettingsResponse) => api.put('/settings', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const jobMutation = useMutation({
    mutationFn: (path: string) => api.post(path),
  });

  const exportMutation = useMutation({
    mutationFn: (format: 'CSV' | 'XLSX' | 'PDF') => api.post('/exports', { format }),
  });

  if (!form) return <div className="text-muted-foreground">Loading settings…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Configure scrapers, audits, rate limits, and run pipeline jobs.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scraper configuration</CardTitle>
            <CardDescription>Enable providers and tune request behaviour.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {form.availableProviders.map((p) => {
                const checked = form.scraper.enabledProviders.includes(p.id);
                return (
                  <label key={p.id} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const enabled = e.target.checked
                          ? [...form.scraper.enabledProviders, p.id]
                          : form.scraper.enabledProviders.filter((id) => id !== p.id);
                        setForm({
                          ...form,
                          scraper: { ...form.scraper, enabledProviders: enabled },
                        });
                      }}
                    />
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="mt-1 block text-muted-foreground">
                        {p.id} · {p.industries.slice(0, 4).join(', ')}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField
                label="Delay (ms)"
                value={form.scraper.requestDelayMs}
                onChange={(v) =>
                  setForm({ ...form, scraper: { ...form.scraper, requestDelayMs: v } })
                }
              />
              <NumberField
                label="Max retries"
                value={form.scraper.maxRetries}
                onChange={(v) => setForm({ ...form, scraper: { ...form.scraper, maxRetries: v } })}
              />
              <NumberField
                label="Timeout (ms)"
                value={form.scraper.timeoutMs}
                onChange={(v) => setForm({ ...form, scraper: { ...form.scraper, timeoutMs: v } })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.audit.lightweight}
                onChange={(e) =>
                  setForm({ ...form, audit: { ...form.audit, lightweight: e.target.checked } })
                }
              />
              Lightweight mode (heuristics only, skip full Lighthouse)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.audit.captureScreenshots}
                onChange={(e) =>
                  setForm({
                    ...form,
                    audit: { ...form.audit, captureScreenshots: e.target.checked },
                  })
                }
              />
              Capture screenshots during audit
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Concurrency"
                value={form.audit.concurrency}
                onChange={(v) => setForm({ ...form, audit: { ...form.audit, concurrency: v } })}
              />
              <NumberField
                label="Lighthouse timeout"
                value={form.audit.lighthouseTimeoutMs}
                onChange={(v) =>
                  setForm({ ...form, audit: { ...form.audit, lighthouseTimeoutMs: v } })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rate limits & export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="HTTP max/sec"
                value={form.rateLimits.httpMaxPerSecond}
                onChange={(v) =>
                  setForm({ ...form, rateLimits: { ...form.rateLimits, httpMaxPerSecond: v } })
                }
              />
              <NumberField
                label="Scrape concurrency"
                value={form.rateLimits.scrapeConcurrency}
                onChange={(v) =>
                  setForm({ ...form, rateLimits: { ...form.rateLimits, scrapeConcurrency: v } })
                }
              />
            </div>
            <div>
              <Label>Default export format</Label>
              <Select
                className="mt-2"
                value={form.export.defaultFormat}
                onChange={(e) =>
                  setForm({
                    ...form,
                    export: {
                      ...form.export,
                      defaultFormat: e.target.value as 'CSV' | 'XLSX' | 'PDF',
                    },
                  })
                }
              >
                <option value="CSV">CSV</option>
                <option value="XLSX">Excel</option>
                <option value="PDF">PDF</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API keys</CardTitle>
            <CardDescription>Configured via environment variables on the API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              OpenAI:{' '}
              <span className={form.apiKeys.openaiConfigured ? 'text-emerald-400' : 'text-amber-400'}>
                {form.apiKeys.openaiConfigured ? 'Configured' : 'Not set (rule-based fallback)'}
              </span>
            </div>
            <div>
              Dashboard API key:{' '}
              <span
                className={
                  form.apiKeys.dashboardApiKeyEnabled ? 'text-emerald-400' : 'text-muted-foreground'
                }
              >
                {form.apiKeys.dashboardApiKeyEnabled ? 'Enabled' : 'Disabled (local open access)'}
              </span>
            </div>
            <p className="text-muted-foreground">
              Set <code>OPENAI_API_KEY</code> and optional <code>API_KEY</code> in <code>.env</code>.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save settings'}
        </Button>
        {saveMutation.isSuccess && <span className="self-center text-sm text-emerald-400">Saved.</span>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline jobs</CardTitle>
          <CardDescription>Trigger backend jobs from the dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => jobMutation.mutate('/jobs/scrape')}>
            Scrape
          </Button>
          <Button variant="secondary" onClick={() => jobMutation.mutate('/jobs/discover-contacts')}>
            Discover contacts
          </Button>
          <Button variant="secondary" onClick={() => jobMutation.mutate('/jobs/audit')}>
            Audit
          </Button>
          <Button variant="secondary" onClick={() => jobMutation.mutate('/jobs/screenshots')}>
            Screenshots
          </Button>
          <Button onClick={() => jobMutation.mutate('/jobs/full-scan')}>Full scan</Button>
          <Button variant="outline" onClick={() => exportMutation.mutate('CSV')}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => exportMutation.mutate('XLSX')}>
            Export Excel
          </Button>
          <Button variant="outline" onClick={() => exportMutation.mutate('PDF')}>
            Export PDF
          </Button>
          {jobMutation.isSuccess && <span className="text-sm text-emerald-400">Job started.</span>}
          {exportMutation.isSuccess && (
            <span className="text-sm text-emerald-400">Export created.</span>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-2"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
