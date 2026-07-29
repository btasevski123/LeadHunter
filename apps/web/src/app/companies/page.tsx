'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  COMPANY_INDUSTRY_OPTIONS_GROUPED,
  MK_CITY_OPTIONS,
  OUTREACH_STATUSES,
} from '@leadhunter/shared';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import type { CompanyListItem, JobRun, Paginated } from '@/lib/types';
import { cn, scoreColor } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const columnHelper = createColumnHelper<CompanyListItem>();

const SOURCES = [
  { id: 'google-maps', label: 'Google Maps' },
  { id: 'yellow-pages', label: 'Yellow Pages' },
  { id: 'companywall', label: 'CompanyWall' },
  { id: 'business-directory', label: 'Business Directory' },
  { id: 'biznismreza', label: 'BiznisMreza' },
  { id: 'google-business', label: 'Google Web' },
  { id: 'industry-directory', label: 'Industry Directory' },
];

function isActiveJob(job: JobRun) {
  return job.status === 'PENDING' || job.status === 'RUNNING' || job.status === 'QUEUED';
}

function isDiscoveryJob(job: JobRun) {
  const t = job.type || '';
  return t.includes('SCRAPE') || t.includes('DISCOVERY');
}

export default function CompaniesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [hasWebsite, setHasWebsite] = useState('');
  const [hasEmail, setHasEmail] = useState('');
  const [outreachStatus, setOutreachStatus] = useState('');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('latestLeadScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [source, setSource] = useState('google-maps');
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const announcedJobRef = useRef<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (industry) params.set('industry', industry);
    if (city) params.set('city', city);
    if (hasWebsite) params.set('hasWebsite', hasWebsite);
    if (hasEmail) params.set('hasEmail', hasEmail);
    if (outreachStatus) params.set('outreachStatus', outreachStatus);
    if (minScore) params.set('minScore', minScore);
    if (maxScore) params.set('maxScore', maxScore);
    params.set('page', String(page));
    params.set('pageSize', '25');
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    return params.toString();
  }, [
    search,
    industry,
    city,
    hasWebsite,
    hasEmail,
    outreachStatus,
    minScore,
    maxScore,
    page,
    sortBy,
    sortDir,
  ]);

  const { data, isLoading } = useQuery({
    queryKey: ['companies', queryString],
    queryFn: () => api.get<Paginated<CompanyListItem>>(`/companies?${queryString}`),
  });

  const { data: jobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get<JobRun[]>('/jobs'),
    refetchInterval: (query) => {
      const list = query.state.data || [];
      return list.some(isActiveJob) ? 2000 : 8000;
    },
  });

  const activeJob =
    (trackedJobId && (jobs || []).find((j) => j.id === trackedJobId)) ||
    (jobs || []).find((j) => isDiscoveryJob(j) && isActiveJob(j)) ||
    null;

  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status === 'COMPLETED' || activeJob.status === 'FAILED') {
      void qc.invalidateQueries({ queryKey: ['companies'] });
      void qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      const key = `${activeJob.id}:${activeJob.status}`;
      if (announcedJobRef.current !== key) {
        announcedJobRef.current = key;
        if (activeJob.status === 'COMPLETED') {
          notify.success('Discovery finished', activeJob.message || undefined);
        } else {
          notify.error(activeJob.message || 'Discovery job failed');
        }
      }
    }
  }, [activeJob?.status, activeJob?.id, activeJob?.message, qc]);

  const discover = useMutation({
    mutationFn: () =>
      api.post<JobRun>(`/jobs/scrape/${source}`, {
        industry: industry || undefined,
        city: city || undefined,
        maxCompaniesPerProvider: 500,
        runPipeline: true,
      }),
    onSuccess: (job) => {
      if (job?.id) setTrackedJobId(job.id);
      void qc.invalidateQueries({ queryKey: ['jobs'] });
      notify.success('Discovery started', SOURCES.find((s) => s.id === source)?.label);
    },
    onError: (error) => notify.error(error, 'Failed to start discovery'),
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('latestLeadScore', {
        header: 'Lead Score',
        cell: (info) => (
          <span className={cn('font-semibold tabular-nums', scoreColor(info.getValue()))}>
            {info.getValue() ?? '—'}
          </span>
        ),
      }),
      columnHelper.accessor('name', {
        header: 'Company',
        cell: (info) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/companies/${info.row.original.id}`}
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor('industry', {
        header: 'Industry',
        cell: (i) => i.getValue() || '—',
      }),
      columnHelper.accessor('city', { header: 'City', cell: (i) => i.getValue() || '—' }),
      columnHelper.accessor('website', {
        header: 'Website',
        cell: (i) =>
          i.getValue() ? (
            <a
              className="text-sky-400 hover:underline"
              href={i.getValue()!}
              target="_blank"
              rel="noreferrer"
            >
              Visit
            </a>
          ) : (
            <Badge variant="warning">No website</Badge>
          ),
      }),
      columnHelper.accessor('email', { header: 'Email', cell: (i) => i.getValue() || '—' }),
      columnHelper.accessor('phone', { header: 'Phone', cell: (i) => i.getValue() || '—' }),
      columnHelper.display({
        id: 'outreach',
        header: 'Outreach',
        cell: (info) => (
          <Badge variant="secondary">
            {info.row.original.outreach?.status || 'NOT_CONTACTED'}
          </Badge>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const industryOptions = COMPANY_INDUSTRY_OPTIONS_GROUPED;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Companies</h1>
        <p className="mt-2 text-muted-foreground">
          Filter the list, or discover new companies for the selected industry and city.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters & discovery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <Input
              placeholder="Search name, email, website…"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
            <Select
              value={industry}
              onChange={(e) => {
                setPage(1);
                setIndustry(e.target.value);
              }}
            >
              <option value="">All industries</option>
              {industryOptions.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.options.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <Select
              value={city}
              onChange={(e) => {
                setPage(1);
                setCity(e.target.value);
              }}
            >
              <option value="">All cities</option>
              {MK_CITY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Select
              value={hasWebsite}
              onChange={(e) => {
                setPage(1);
                setHasWebsite(e.target.value);
              }}
            >
              <option value="">Website: any</option>
              <option value="true">Has website</option>
              <option value="false">No website</option>
            </Select>
            <Select
              value={hasEmail}
              onChange={(e) => {
                setPage(1);
                setHasEmail(e.target.value);
              }}
            >
              <option value="">Email: any</option>
              <option value="true">Has email</option>
              <option value="false">No email</option>
            </Select>
            <Select
              value={outreachStatus}
              onChange={(e) => {
                setPage(1);
                setOutreachStatus(e.target.value);
              }}
            >
              <option value="">Outreach: any</option>
              {OUTREACH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              placeholder="Min score"
              value={minScore}
              onChange={(e) => {
                setPage(1);
                setMinScore(e.target.value);
              }}
            />
            <Input
              type="number"
              placeholder="Max score"
              value={maxScore}
              onChange={(e) => {
                setPage(1);
                setMaxScore(e.target.value);
              }}
            />
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="latestLeadScore">Sort: Lead score</option>
              <option value="name">Sort: Name</option>
              <option value="city">Sort: City</option>
              <option value="industry">Sort: Industry</option>
              <option value="createdAt">Sort: Created</option>
            </Select>
            <Select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </Select>
            <Select value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Button
              className="w-full"
              disabled={discover.isPending || Boolean(activeJob && isActiveJob(activeJob))}
              onClick={() => discover.mutate()}
            >
              {discover.isPending
                ? 'Starting…'
                : activeJob && isActiveJob(activeJob)
                  ? 'Discovering…'
                  : 'Discover'}
            </Button>
          </div>

          {activeJob ? (
            <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {activeJob.type}
                  {industry ? ` · ${industry}` : ''}
                  {city ? ` · ${city}` : ''}
                </span>
                <Badge variant="outline">{activeJob.status}</Badge>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-500"
                  style={{ width: `${Math.min(100, activeJob.progress || 0)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {activeJob.progress || 0}%
                {activeJob.message ? ` · ${activeJob.message}` : ''}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} className="px-4 py-3 font-medium text-muted-foreground">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-muted-foreground" colSpan={columns.length}>
                    Loading companies…
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-muted-foreground" colSpan={columns.length}>
                    No companies found. Pick industry + city and hit Discover.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/70 hover:bg-accent/30">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {data ? `${data.total} companies · page ${data.page}/${data.totalPages}` : ''}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={!data || page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
