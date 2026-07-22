'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { INDUSTRY_OPTIONS, MK_CITY_OPTIONS, OUTREACH_STATUSES } from '@leadhunter/shared';
import { api } from '@/lib/api';
import type { CompanyListItem, Paginated } from '@/lib/types';
import { cn, scoreColor } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const columnHelper = createColumnHelper<CompanyListItem>();

export default function CompaniesPage() {
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
  }, [search, industry, city, hasWebsite, hasEmail, outreachStatus, minScore, maxScore, page, sortBy, sortDir]);

  const { data, isLoading } = useQuery({
    queryKey: ['companies', queryString],
    queryFn: () => api.get<Paginated<CompanyListItem>>(`/companies?${queryString}`),
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
          <Link className="font-medium text-primary hover:underline" href={`/companies/${info.row.original.id}`}>
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor('industry', { header: 'Industry', cell: (i) => i.getValue() || '—' }),
      columnHelper.accessor('city', { header: 'City', cell: (i) => i.getValue() || '—' }),
      columnHelper.accessor('website', {
        header: 'Website',
        cell: (i) =>
          i.getValue() ? (
            <a className="text-sky-400 hover:underline" href={i.getValue()!} target="_blank" rel="noreferrer">
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
          <Badge variant="secondary">{info.row.original.outreach?.status || 'NOT_CONTACTED'}</Badge>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Companies</h1>
        <p className="mt-2 text-muted-foreground">Search, filter, and open opportunities.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
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
            {INDUSTRY_OPTIONS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
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
          <Select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
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
                    No companies found. Run <code>npm run scrape</code> or full-scan.
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
