'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OUTREACH_STATUSES } from '@leadhunter/shared';
import { api, storageUrl } from '@/lib/api';
import { cn, formatDate, scoreColor } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

type CompanyDetail = {
  id: string;
  name: string;
  industry: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  latestLeadScore: number | null;
  outreach: {
    id: string;
    status: string;
    notes: string | null;
    contactDate: string | null;
    followUpDate: string | null;
    meetingDate: string | null;
    history: { id: string; body: string; createdAt: string }[];
  } | null;
  screenshot: { desktopPath: string | null; mobilePath: string | null } | null;
  contacts: { id: string; type: string; value: string; confidence: number; isPrimary: boolean }[];
  emailTemplates: {
    id: string;
    subject: string;
    content: string;
    kind: string;
    language: string;
    toEmail: string | null;
    sentAt: string | null;
    sentError: string | null;
    createdAt: string;
  }[];
  classification: {
    id: string;
    classification: string;
    confidence: number;
    reasons: string[];
    recommendedService: string;
    updatedAt: string;
  } | null;
  audits: {
    id: string;
    leadScore: number;
    scoreReasons: string[];
    auditSummary: string | null;
    aiRecommendations: string | null;
    designAgeEstimate: string | null;
    sslEnabled: boolean;
    mobileFriendly: boolean;
    lighthousePerformance: number | null;
    lighthouseSeo: number | null;
    lighthouseAccessibility: number | null;
    hasContactForm: boolean;
    auditedAt: string;
    issues: { id: string; code: string; severity: string; title: string; description: string }[];
  }[];
};

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [emailLanguage, setEmailLanguage] = useState<'en' | 'mk'>('mk');
  const [sendToOverride, setSendToOverride] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['company', id],
    queryFn: () => api.get<CompanyDetail>(`/companies/${id}`),
  });

  const { data: emailStatus } = useQuery({
    queryKey: ['email-status'],
    queryFn: () =>
      api.get<{ smtpConfigured: boolean; fromEmail: string | null; fromName: string | null }>(
        '/emails/status',
      ),
  });

  const auditMutation = useMutation({
    mutationFn: () => api.post(`/companies/${id}/audit`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', id] }),
  });

  const classifyMutation = useMutation({
    mutationFn: () => api.post(`/companies/${id}/classify`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', id] }),
  });

  const emailMutation = useMutation({
    mutationFn: () =>
      api.post('/emails/generate', {
        companyId: id,
        kind: 'OUTREACH',
        language: emailLanguage,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', id] }),
  });

  const sendMutation = useMutation({
    mutationFn: (templateId: string) =>
      api.post(`/emails/${templateId}/send`, {
        toEmail: sendToOverride.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['company', id] });
    },
  });

  const outreachMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch(`/outreach/${data?.outreach?.id}`, body),
    onSuccess: () => {
      setNote('');
      qc.invalidateQueries({ queryKey: ['company', id] });
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading company…</div>;
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/companies" className="text-primary hover:underline">
          ← Back
        </Link>
        <div className="text-rose-400">Company not found</div>
      </div>
    );
  }

  const audit = data.audits[0];
  const classification = data.classification;
  const desktop = storageUrl(data.screenshot?.desktopPath);
  const mobile = storageUrl(data.screenshot?.mobilePath);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/companies" className="text-sm text-muted-foreground hover:text-foreground">
            ← Companies
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">{data.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {[data.industry, data.city].filter(Boolean).join(' · ') || 'No industry/city'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => auditMutation.mutate()} disabled={auditMutation.isPending}>
            {auditMutation.isPending ? 'Auditing…' : 'Run audit'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => classifyMutation.mutate()}
            disabled={classifyMutation.isPending}
          >
            {classifyMutation.isPending ? 'Classifying…' : 'Classify lead'}
          </Button>
          <Select
            value={emailLanguage}
            onChange={(e) => setEmailLanguage(e.target.value as 'en' | 'mk')}
            className="w-[140px]"
          >
            <option value="mk">Македонски</option>
            <option value="en">English</option>
          </Select>
          <Button
            variant="secondary"
            onClick={() => emailMutation.mutate()}
            disabled={emailMutation.isPending}
          >
            {emailMutation.isPending ? 'Generating…' : 'Generate email'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Company information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <Field label="Website" value={data.website} link />
            <Field label="Email" value={data.email} />
            <Field label="Phone" value={data.phone} />
            <Field label="Address" value={data.address} />
            <Field label="Facebook" value={data.facebookUrl} link />
            <Field label="LinkedIn" value={data.linkedinUrl} link />
            <Field label="Instagram" value={data.instagramUrl} link />
            <Field label="Source" value={data.sourceName} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Lead score</CardDescription>
            <CardTitle className={cn('font-display text-5xl', scoreColor(data.latestLeadScore))}>
              {data.latestLeadScore ?? '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(audit?.scoreReasons || []).map((r) => (
              <div key={r} className="rounded-md bg-muted/50 px-3 py-2">
                {r}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Classification</CardTitle>
            <CardDescription>
              {classification
                ? `Updated ${formatDate(classification.updatedAt)}`
                : 'Deterministic KVADRA opportunity rules'}
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            onClick={() => classifyMutation.mutate()}
            disabled={classifyMutation.isPending}
          >
            {classifyMutation.isPending ? 'Recalculating…' : classification ? 'Recalculate' : 'Classify'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {classification ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-muted/40 px-3 py-3">
                  <div className="text-xs text-muted-foreground">Classification</div>
                  <div className="mt-1 font-medium">{classification.classification}</div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-3">
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div className="mt-1 font-medium">{classification.confidence}%</div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-3">
                  <div className="text-xs text-muted-foreground">Recommended Service</div>
                  <div className="mt-1 font-medium">{classification.recommendedService}</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-medium">Reasons</div>
                {classification.reasons.length === 0 ? (
                  <p className="text-muted-foreground">No reasons recorded.</p>
                ) : (
                  classification.reasons.map((reason) => (
                    <div key={reason} className="rounded-md border border-border px-3 py-2">
                      {reason}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              No classification yet. Run Classify to determine the KVADRA service opportunity.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Website audit</CardTitle>
            <CardDescription>{audit ? formatDate(audit.auditedAt) : 'Not audited yet'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {audit ? (
              <>
                <p>{audit.auditSummary}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="SSL" value={audit.sslEnabled ? 'Yes' : 'No'} />
                  <Metric label="Mobile" value={audit.mobileFriendly ? 'Yes' : 'No'} />
                  <Metric label="Performance" value={audit.lighthousePerformance ?? '—'} />
                  <Metric label="SEO" value={audit.lighthouseSeo ?? '—'} />
                  <Metric label="A11y" value={audit.lighthouseAccessibility ?? '—'} />
                  <Metric label="Design age" value={audit.designAgeEstimate || '—'} />
                </div>
                <div className="space-y-2">
                  <div className="font-medium">Issues</div>
                  {audit.issues.map((issue) => (
                    <div key={issue.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span>{issue.title}</span>
                        <Badge
                          variant={
                            issue.severity === 'CRITICAL' || issue.severity === 'HIGH'
                              ? 'danger'
                              : issue.severity === 'MEDIUM'
                                ? 'warning'
                                : 'secondary'
                          }
                        >
                          {issue.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{issue.description}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Run an audit to generate findings.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
              {audit?.aiRecommendations || 'No recommendations yet.'}
            </pre>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Desktop screenshot</CardTitle>
          </CardHeader>
          <CardContent>
            {desktop ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={desktop} alt="Desktop screenshot" className="w-full rounded-lg border border-border" />
            ) : (
              <p className="text-sm text-muted-foreground">No desktop screenshot.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mobile screenshot</CardTitle>
          </CardHeader>
          <CardContent>
            {mobile ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mobile} alt="Mobile screenshot" className="mx-auto max-w-[280px] rounded-lg border border-border" />
            ) : (
              <p className="text-sm text-muted-foreground">No mobile screenshot.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.contacts.length === 0 ? (
              <p className="text-muted-foreground">No contacts discovered yet.</p>
            ) : (
              data.contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <div className="font-medium">{c.value}</div>
                    <div className="text-muted-foreground">
                      {c.type} · confidence {(c.confidence * 100).toFixed(0)}%
                      {c.isPrimary ? ' · primary' : ''}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outreach</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.outreach ? (
              <>
                <Select
                  value={data.outreach.status}
                  onChange={(e) => outreachMutation.mutate({ status: e.target.value })}
                >
                  {OUTREACH_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
                <Textarea
                  placeholder="Add a note…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  variant="secondary"
                  disabled={!note || outreachMutation.isPending}
                  onClick={() => outreachMutation.mutate({ noteBody: note, notes: note })}
                >
                  Save note
                </Button>
                <div className="space-y-2 text-sm">
                  {data.outreach.history.map((h) => (
                    <div key={h.id} className="rounded-md bg-muted/40 px-3 py-2">
                      <div className="text-xs text-muted-foreground">{formatDate(h.createdAt)}</div>
                      <div>{h.body}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No outreach record.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generated emails</CardTitle>
          <CardDescription>
            {emailStatus?.smtpConfigured
              ? `Sends from ${emailStatus.fromName || emailStatus.fromEmail}`
              : 'SMTP not configured — add SMTP_* vars in .env to send from the platform'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 space-y-1">
              <div className="text-xs text-muted-foreground">Send to (optional override)</div>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={data.email || 'client@example.com'}
                value={sendToOverride}
                onChange={(e) => setSendToOverride(e.target.value)}
              />
            </div>
          </div>

          {emailMutation.isError ? (
            <p className="text-sm text-rose-400">Failed to generate email.</p>
          ) : null}
          {sendMutation.isError ? (
            <p className="text-sm text-rose-400">
              {(sendMutation.error as Error)?.message || 'Failed to send email.'}
            </p>
          ) : null}

          {data.emailTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No generated emails yet. Pick a language and click Generate email.
            </p>
          ) : (
            data.emailTemplates.map((t) => (
              <div key={t.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{t.subject}</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{t.kind}</Badge>
                    <Badge variant="secondary">{t.language === 'mk' ? 'MK' : 'EN'}</Badge>
                    {t.sentAt ? <Badge variant="success">Sent</Badge> : null}
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  To: {t.toEmail || data.email || sendToOverride || '—'}
                  {t.sentAt ? ` · Sent ${formatDate(t.sentAt)}` : ''}
                </div>
                {t.sentError ? (
                  <p className="mt-2 text-sm text-rose-400">{t.sentError}</p>
                ) : null}
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                  {t.content}
                </pre>
                <div className="mt-3">
                  <Button
                    size="sm"
                    disabled={
                      sendMutation.isPending ||
                      !emailStatus?.smtpConfigured ||
                      !(sendToOverride.trim() || t.toEmail || data.email)
                    }
                    onClick={() => sendMutation.mutate(t.id)}
                  >
                    {sendMutation.isPending && sendMutation.variables === t.id
                      ? 'Sending…'
                      : t.sentAt
                        ? 'Send again'
                        : 'Send email'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, link }: { label: string; value?: string | null; link?: boolean }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      {value ? (
        link ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline break-all">
            {value}
          </a>
        ) : (
          <div className="break-all">{value}</div>
        )
      ) : (
        <div>—</div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
