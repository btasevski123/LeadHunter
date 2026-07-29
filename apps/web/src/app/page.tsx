'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import type { DashboardStats, JobRun } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const COLORS = ['#2dd4bf', '#38bdf8', '#f59e0b', '#f43f5e', '#a78bfa', '#84cc16'];

const SOURCE_LABELS: Record<string, string> = {
  COMPANY_WALL: 'CompanyWall',
  BIZNIS_MREZA: 'BiznisMreza',
  YELLOW_PAGES: 'YellowPages',
  GOOGLE_DISCOVERY: 'Google',
  INDUSTRY_DIRECTORY: 'IndustryDirectory',
};

export default function HomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats'),
    refetchInterval: 15000,
  });

  const { data: jobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get<JobRun[]>('/jobs'),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return <div className="text-muted-foreground">Loading dashboard…</div>;
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">
        Could not load dashboard. Is the API running on {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}?
      </div>
    );
  }

  const kpis = [
    { label: 'Real Companies', value: data.totalCompanies },
    { label: 'Without Website', value: data.companiesWithoutWebsite },
    { label: 'High Value Leads', value: data.highValueLeads },
    { label: 'Emails Found', value: data.emailsFound },
    { label: 'Websites Audited', value: data.websitesAudited },
    { label: 'Avg Lead Score', value: data.averageLeadScore },
  ];

  const recentJobs = (jobs || []).slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Live Macedonian company intelligence from CompanyWall, BiznisMreza, Yellow Pages, and Google discovery.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="overflow-hidden transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle className="font-display text-3xl">{kpi.value.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardDescription>Companies by discovery source</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.bySource || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No real imports yet. Run <code className="rounded bg-muted px-1">npm run scrape:all</code>.
              </p>
            ) : (
              (data.bySource || []).map((s) => (
                <div key={s.name} className="flex items-center justify-between border-b border-border/60 py-2 last:border-0">
                  <span>{SOURCE_LABELS[s.name] || s.name}</span>
                  <span className="font-display text-xl tabular-nums">{s.count.toLocaleString()}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
            <CardDescription>
              Running {data.jobs?.running || 0} · Completed {data.jobs?.completed || 0} · Failed{' '}
              {data.jobs?.failed || 0}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs yet.</p>
            ) : (
              recentJobs.map((job) => (
                <div key={job.id} className="space-y-1 border-b border-border/60 pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{job.type}</span>
                    <Badge variant="outline">{job.status}</Badge>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${job.progress || 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {job.progress || 0}% · {job.message || '—'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Companies by Industry</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byIndustry}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2dd4bf" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Companies by City</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byCity}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead Score Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.leadScoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="bucket" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Website Quality</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.websiteQualityDistribution}
                  dataKey="count"
                  nameKey="name"
                  outerRadius={100}
                  label
                >
                  {data.websiteQualityDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Outreach Funnel</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.outreachFunnel}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={80} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#a78bfa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
