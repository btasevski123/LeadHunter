'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { OUTREACH_STATUSES } from '@leadhunter/shared';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { cn, scoreColor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type OutreachRow = {
  id: string;
  status: string;
  notes: string | null;
  company: {
    id: string;
    name: string;
    industry: string | null;
    city: string | null;
    latestLeadScore: number | null;
    website: string | null;
  };
};

type Board = Record<string, OutreachRow[]>;

export default function OutreachPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['outreach-board'],
    queryFn: () => api.get<Board>('/outreach/board'),
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/outreach/${id}`, { status }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['outreach-board'] });
      notify.success('Status updated', variables.status.replaceAll('_', ' '));
    },
    onError: (error) => notify.error(error, 'Failed to update status'),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(event: DragEndEvent) {
    const outreachId = String(event.active.id);
    const status = event.over?.id ? String(event.over.id) : null;
    if (!status || !OUTREACH_STATUSES.includes(status as (typeof OUTREACH_STATUSES)[number])) return;
    const current = Object.values(data || {})
      .flat()
      .find((r) => r.id === outreachId);
    if (!current || current.status === status) return;
    mutation.mutate({ id: outreachId, status });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Outreach CRM</h1>
        <p className="mt-2 text-muted-foreground">
          Drag cards between columns to update outreach status.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="text-muted-foreground">Loading board…</div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {OUTREACH_STATUSES.map((status) => (
              <Column key={status} status={status} items={data[status] || []} />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}

function Column({ status, items }: { status: string; items: OutreachRow[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'w-72 shrink-0 rounded-xl border border-border bg-card/50 p-3',
        isOver && 'border-primary/60 bg-primary/5',
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold tracking-wide">{status.replaceAll('_', ' ')}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <KanbanCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({ item }: { item: OutreachRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn('cursor-grab active:cursor-grabbing', isDragging && 'opacity-70 shadow-lg')}
      {...listeners}
      {...attributes}
    >
      <CardHeader className="space-y-1 p-3">
        <CardTitle className="text-sm">
          <Link href={`/companies/${item.company.id}`} className="hover:text-primary">
            {item.company.name}
          </Link>
        </CardTitle>
        <div className="text-xs text-muted-foreground">
          {[item.company.industry, item.company.city].filter(Boolean).join(' · ') || '—'}
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between p-3 pt-0 text-xs">
        <span className={cn('font-semibold', scoreColor(item.company.latestLeadScore))}>
          Score {item.company.latestLeadScore ?? '—'}
        </span>
        <span className="text-muted-foreground">{item.company.website ? 'Has site' : 'No site'}</span>
      </CardContent>
    </Card>
  );
}
