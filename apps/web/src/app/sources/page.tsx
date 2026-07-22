'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SourcesResponse = {
  total: number;
  sources: Array<{
    sourceName: string;
    label: string;
    companiesFound: number;
    inDatabase: number;
    duplicates: number;
    newCompanies: number;
    runs: number;
  }>;
};

export default function SourcesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sources'],
    queryFn: () => api.get<SourcesResponse>('/sources'),
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Sources</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Multi-source discovery stats — Google Maps, CompanyWall, directories, and more.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Total companies in database</CardDescription>
          <CardTitle className="font-display text-4xl">
            {(data?.total || 0).toLocaleString()}
          </CardTitle>
        </CardHeader>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Loading sources…</p>
      ) : error ? (
        <p className="text-rose-400">Could not load source stats.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data?.sources || []).map((source) => (
            <Card key={source.sourceName}>
              <CardHeader>
                <CardTitle>{source.label}</CardTitle>
                <CardDescription>{source.sourceName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Companies found</span>
                  <span className="font-display text-xl tabular-nums">
                    {source.companiesFound.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">In database</span>
                  <span className="tabular-nums">{source.inDatabase.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duplicates</span>
                  <span className="tabular-nums">{source.duplicates.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New companies</span>
                  <span className="tabular-nums">{source.newCompanies.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-2">
                  <span className="text-muted-foreground">Import runs</span>
                  <span className="tabular-nums">{source.runs}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
