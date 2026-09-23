"use client";

import { SIGNAL_TYPES } from "@/config/signals";
import { SECTOR_OPTIONS, type DirectionFilter, type Filters, type RegionFilter, type SortKey } from "@/lib/discover";
import { SegmentedControl } from "../ui/segmented";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`press shrink-0 rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
        active ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-fg-2 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

export function TypeChips({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <>
      {SIGNAL_TYPES.map((t) => {
        const active = filters.types.includes(t.id);
        return (
          <Chip
            key={t.id}
            active={active}
            onClick={() =>
              onChange({
                ...filters,
                types: active ? filters.types.filter((x) => x !== t.id) : [...filters.types, t.id],
              })
            }
          >
            {t.label}
          </Chip>
        );
      })}
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-5 first:mt-1">
      <legend className="mb-2 text-[0.8125rem] font-semibold uppercase tracking-wide text-fg-2">{title}</legend>
      {children}
    </fieldset>
  );
}

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
            { value: "DE", label: "DAX" },
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
        <div className="mt-1 flex justify-between text-[0.75rem] text-fg-2" aria-hidden="true">
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
          {SECTOR_OPTIONS.map((s) => {
            const active = filters.sectors.includes(s.id);
            return (
              <Chip
                key={s.id}
                active={active}
                onClick={() =>
                  onChange({
                    ...filters,
                    sectors: active ? filters.sectors.filter((x) => x !== s.id) : [...filters.sectors, s.id],
                  })
                }
              >
                {s.label}
              </Chip>
            );
          })}
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
