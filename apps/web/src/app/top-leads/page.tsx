'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CompanyListItem } from '@/lib/types';
import { cn, scoreColor } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TopLeadsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['top-leads'],
    queryFn: () => api.get<CompanyListItem[]>('/companies/top?limit=50'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Top Leads</h1>
        <p className="mt-2 text-muted-foreground">
          Highest-scoring opportunities (score ≥ 70), sorted by lead score.
        </p>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          <div className="text-muted-foreground">Loading top leads…</div>
        ) : !data?.length ? (
          <Card>
            <CardContent className="py-8 text-muted-foreground">
              No high-value leads yet. Run scrape + audit (or full-scan).
            </CardContent>
          </Card>
        ) : (
          data.map((company, index) => (
            <Card key={company.id} className="cursor-pointer transition hover:border-primary/40 hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">#{index + 1}</div>
                  <CardTitle className="truncate">
                    <Link href={`/companies/${company.id}`} className="hover:text-primary">
                      {company.name}
                    </Link>
                  </CardTitle>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {[company.industry, company.city].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn('font-display text-3xl font-semibold', scoreColor(company.latestLeadScore))}>
                    {company.latestLeadScore ?? '—'}
                  </div>
                  <Badge variant="secondary" className="mt-1">
                    {company.outreach?.status || 'NOT_CONTACTED'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>{company.website || 'No website'}</span>
                <span>{company.email || 'No email'}</span>
                <span>{company.phone || 'No phone'}</span>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
