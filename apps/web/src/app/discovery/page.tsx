'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INDUSTRY_OPTIONS, MK_CITIES } from '@leadhunter/shared';
import { api } from '@/lib/api';
import type { JobRun } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

const SOURCES = [
  { id: 'google-maps', label: 'Google Maps' },
  { id: 'companywall', label: 'CompanyWall' },
  { id: 'yellow-pages', label: 'Yellow Pages' },
  { id: 'business-directory', label: 'Business Directory' },
  { id: 'biznismreza', label: 'BiznisMreza' },
  { id: 'google-business', label: 'Google Web Discovery' },
  { id: 'industry-directory', label: 'Industry Directory' },
  { id: 'central-registry', label: 'Central Registry (licensed)' },
];

export default function DiscoveryPage() {
  const qc = useQueryClient();
  const [industry, setIndustry] = useState('PRINTING');
  const [city, setCity] = useState('Скопје');
  const [source, setSource] = useState('google-maps');
  const [max, setMax] = useState('500');
  const [runPipeline, setRunPipeline] = useState(true);

  const { data: jobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get<JobRun[]>('/jobs'),
    refetchInterval: 4000,
  });

  const discover = useMutation({
    mutationFn: () =>
      api.post(`/jobs/scrape/${source}`, {
        industry: industry || undefined,
        city: city || undefined,
        maxCompaniesPerProvider: Number(max) || 500,
        runPipeline,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['jobs'] });
      void qc.invalidateQueries({ queryKey: ['sources'] });
      void qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      void qc.invalidateQueries({ queryKey: ['imports'] });
    },
  });

  const recent = (jobs || []).slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Discovery</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Launch industry- and city-scoped discovery jobs across Macedonian business sources.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run discovery</CardTitle>
          <CardDescription>
            Designed for thousands of companies — uses queues, pagination, and batch persistence.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Industry</Label>
            <Select value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="">All industries</option>
              {INDUSTRY_OPTIONS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">All major cities</option>
              {MK_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="Скопје">Скопје</option>
              <option value="Битола">Битола</option>
              <option value="Охрид">Охрид</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Max companies</Label>
            <Input
              type="number"
              min={1}
              max={50000}
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={runPipeline}
              onChange={(e) => setRunPipeline(e.target.checked)}
            />
            Continue with website audit + contact discovery + lead scoring
          </label>
          <div className="md:col-span-2">
            <Button disabled={discover.isPending} onClick={() => discover.mutate()}>
              {discover.isPending ? 'Starting…' : 'Start discovery job'}
            </Button>
            {discover.isSuccess ? (
              <p className="mt-2 text-sm text-emerald-400">Job queued. Track progress below.</p>
            ) : null}
            {discover.isError ? (
              <p className="mt-2 text-sm text-rose-400">Failed to start discovery job.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs yet.</p>
          ) : (
            recent.map((job) => (
              <div key={job.id} className="space-y-1 border-b border-border/60 pb-2 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{job.type}</span>
                  <Badge variant="outline">{job.status}</Badge>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${job.progress || 0}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {job.progress || 0}% · {job.message || '—'}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
