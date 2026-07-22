'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ImportRun } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function statusTone(status: string) {
  if (status === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-400';
  if (status === 'FAILED') return 'bg-rose-500/15 text-rose-400';
  if (status === 'RUNNING') return 'bg-sky-500/15 text-sky-400';
  return 'bg-muted text-muted-foreground';
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function ImportsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['imports'],
    queryFn: () => api.get<ImportRun[]>('/imports'),
    refetchInterval: 5000,
  });

  const scrapeAll = useMutation({
    mutationFn: () =>
      api.post('/jobs/scrape', {
        maxCompaniesPerProvider: 100,
        runPipeline: true,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['imports'] });
      void qc.invalidateQueries({ queryKey: ['jobs'] });
      void qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const scrapeYp = useMutation({
    mutationFn: () =>
      api.post('/jobs/scrape/yellow-pages', {
        maxCompaniesPerProvider: 100,
        runPipeline: true,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['imports'] });
      void qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Imports</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Monitor provider scrapes: companies found, duplicates removed, and errors.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={scrapeYp.isPending}
            onClick={() => scrapeYp.mutate()}
          >
            Scrape Yellow Pages
          </Button>
          <Button disabled={scrapeAll.isPending} onClick={() => scrapeAll.mutate()}>
            Run scrape:all
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import runs</CardTitle>
          <CardDescription>Newest first</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-rose-400">Could not load imports.</p>
          ) : !data?.length ? (
            <p className="text-muted-foreground">
              No imports yet. Start with Yellow Pages or scrape:all.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Provider</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Started</th>
                    <th className="py-2 pr-3 font-medium">Completed</th>
                    <th className="py-2 pr-3 font-medium">Found</th>
                    <th className="py-2 pr-3 font-medium">Created</th>
                    <th className="py-2 pr-3 font-medium">Duplicates</th>
                    <th className="py-2 pr-3 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => {
                    const errors = Array.isArray(row.errors) ? row.errors : [];
                    return (
                      <tr key={row.id} className="border-b border-border/70 align-top">
                        <td className="py-3 pr-3">
                          <div className="font-medium">{row.providerName}</div>
                          <div className="text-xs text-muted-foreground">{row.providerId}</div>
                          {row.industryFilter ? (
                            <div className="text-xs text-muted-foreground">
                              Industry: {row.industryFilter}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`rounded-md px-2 py-1 text-xs ${statusTone(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">{formatWhen(row.startedAt)}</td>
                        <td className="py-3 pr-3 whitespace-nowrap">{formatWhen(row.completedAt)}</td>
                        <td className="py-3 pr-3 tabular-nums">{row.companiesFound}</td>
                        <td className="py-3 pr-3 tabular-nums">{row.companiesCreated}</td>
                        <td className="py-3 pr-3 tabular-nums">{row.duplicatesRemoved}</td>
                        <td className="py-3 pr-3">
                          {errors.length === 0 ? (
                            <span className="text-muted-foreground">0</span>
                          ) : (
                            <div className="max-w-xs space-y-1">
                              <Badge variant="outline">{errors.length}</Badge>
                              <p className="line-clamp-2 text-xs text-rose-300/90">
                                {String(errors[0])}
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
