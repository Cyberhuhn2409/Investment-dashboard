"use client";

import { SIGNAL_TYPES } from "@/config/signals";
import { INDEX_IDS, SIZE_CLASSES } from "@/config/universe";
import {
  SECTOR_OPTIONS,
  type DirectionFilter,
  type Filters,
  type RegionFilter,
  type SortKey,
} from "@/lib/discover";
import { SegmentedControl } from "../ui/segmented";

export function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      className={`press shrink-0 rounded-lg border px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
        active ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-fg-2 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function TypeChips({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <>
      {SIGNAL_TYPES.map((t) => (
        <Chip key={t.id} active={filters.types.includes(t.id)} onClick={() => onChange({ ...filters, types: toggle(filters.types, t.id) })}>
          {t.label}
        </Chip>
      ))}
    </>
  );
}

/** Größenklassen + deutsche Indizes als Schnellfilter. */
export function SegmentChips({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <>
      {SIZE_CLASSES.map((c) => (
        <Chip
          key={c.id}
          active={filters.sizes.includes(c.id)}
          onClick={() => onChange({ ...filters, sizes: toggle(filters.sizes, c.id) })}
          title={`${c.label} (${c.range})`}
        >
          {c.label}
        </Chip>
      ))}
      <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-line-strong" />
      {INDEX_IDS.map((id) => (
        <Chip key={id} active={filters.indices.includes(id)} onClick={() => onChange({ ...filters, indices: toggle(filters.indices, id) })}>
          {id}
        </Chip>
      ))}
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-5 first:mt-1">
      <legend className="label-mono mb-2 text-fg-2">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Weitere Filter (Ansicht, Größe und Index stehen direkt über der Liste). */
export function FilterPanel({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <div>
      <Group title="Region">
        <SegmentedControl<RegionFilter>
          label="Region"
          value={filters.region}
          onChange={(region) => onChange({ ...filters, region })}
          options={[
            { value: "ALL", label: "Alle" },
            { value: "US", label: "USA" },
            { value: "DE", label: "Deutschland" },
          ]}
          className="w-full"
        />
      </Group>

      <Group title="Signaltyp">
        <div className="flex flex-wrap gap-2">
          <TypeChips filters={filters} onChange={onChange} />
        </div>
      </Group>

      <Group title={`Mindest-Score: ${filters.minScore}`}>
        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={filters.minScore}
          onChange={(e) => onChange({ ...filters, minScore: Number(e.target.value) })}
          aria-label="Mindest-Score"
          aria-valuetext={`Score mindestens ${filters.minScore}`}
          className="w-full accent-[var(--accent)]"
        />
        <div className="tnum mt-1 flex justify-between text-[0.75rem] text-fg-2" aria-hidden="true">
          <span>0</span>
          <span>60 = markiert</span>
          <span>90</span>
        </div>
      </Group>

      <Group title="Tendenz">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["ALL", "Alle"],
              ["bullish", "▲ Positiv"],
              ["bearish", "▼ Negativ"],
              ["neutral", "◆ Gemischt"],
            ] as [DirectionFilter, string][]
          ).map(([value, label]) => (
            <Chip key={value} active={filters.direction === value} onClick={() => onChange({ ...filters, direction: value })}>
              {label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Sektoren">
        <div className="flex flex-wrap gap-2">
          {SECTOR_OPTIONS.map((s) => (
            <Chip
              key={s.id}
              active={filters.sectors.includes(s.id)}
              onClick={() => onChange({ ...filters, sectors: toggle(filters.sectors, s.id) })}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Sortierung">
        <SegmentedControl<SortKey>
          label="Sortierung"
          value={filters.sort}
          onChange={(sort) => onChange({ ...filters, sort })}
          options={[
            { value: "score", label: "Score" },
            { value: "buzz", label: "Buzz" },
            { value: "change", label: "Bewegung" },
            { value: "name", label: "A–Z" },
          ]}
          size="sm"
          className="w-full"
        />
      </Group>
    </div>
  );
}
