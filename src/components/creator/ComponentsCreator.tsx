import { useMemo } from 'react'
import { PRESET_DESIGNS } from '../../physics/presets'
import {
  type ComponentType,
  type RocketComponent,
  buildStages,
  dryMassTotal,
  liftoffMass,
  liftoffTWR,
  propellantMassTotal,
  rocketDiameter,
  totalImpulseOf,
} from '../../physics/rocket'
import { formatNumber } from '../../lib/format'
import { useRocketStore } from '../../store/rocketStore'
import { Card } from '../ui/Card'
import { Stat } from '../ui/Stat'
import { Button, NumberField, TextField } from '../ui/fields'
import { COMPONENT_ICONS, COMPONENT_LABELS, createDefaultComponent } from './defaults'
import { ComponentFields } from './ComponentFields'

const ADDABLE_TYPES: ComponentType[] = ['nose-cone', 'body-tube', 'fins', 'engine', 'payload', 'recovery']

export function ComponentsCreator() {
  const design = useRocketStore((s) => s.design)
  const addComponent = useRocketStore((s) => s.addComponent)
  const updateComponent = useRocketStore((s) => s.updateComponent)
  const removeComponent = useRocketStore((s) => s.removeComponent)
  const moveComponent = useRocketStore((s) => s.moveComponent)
  const renameDesign = useRocketStore((s) => s.renameDesign)
  const loadPreset = useRocketStore((s) => s.loadPreset)
  const resetDesign = useRocketStore((s) => s.resetDesign)

  const stages = useMemo(() => buildStages(design.components), [design.components])
  const mass = liftoffMass(design)
  const dry = dryMassTotal(design)
  const prop = propellantMassTotal(design)
  const impulse = totalImpulseOf(design)
  const twr = liftoffTWR(design)
  const diameter = rocketDiameter(design.components)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card
          title="Rocket Design"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <select
                onChange={(e) => e.target.value && loadPreset(e.target.value)}
                defaultValue=""
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="" disabled>
                  Load preset…
                </option>
                {PRESET_DESIGNS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button variant="ghost" onClick={resetDesign}>
                New
              </Button>
            </div>
          }
        >
          <TextField label="Design Name" value={design.name} onChange={renameDesign} />
        </Card>

        <Card title="Add Component" subtitle="Build your rocket stack from the palette below">
          <div className="flex flex-wrap gap-2">
            {ADDABLE_TYPES.map((type) => (
              <Button key={type} variant="secondary" onClick={() => addComponent(createDefaultComponent(type, design.components))}>
                <span className="mr-1.5">{COMPONENT_ICONS[type]}</span>
                {COMPONENT_LABELS[type]}
              </Button>
            ))}
          </div>
        </Card>

        <div className="space-y-3">
          {design.components.length === 0 && (
            <Card>
              <p className="text-sm text-slate-500">No components yet. Add a nose cone, body tube, and engine to get started.</p>
            </Card>
          )}
          {design.components.map((component, idx) => (
            <ComponentRow
              key={component.id}
              component={component}
              index={idx}
              total={design.components.length}
              onChange={(updates) => updateComponent(component.id, updates)}
              onRemove={() => removeComponent(component.id)}
              onMoveUp={() => moveComponent(component.id, 'up')}
              onMoveDown={() => moveComponent(component.id, 'down')}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Card title="Design Summary">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Liftoff Mass" value={formatNumber(mass, 2)} unit="kg" accent="sky" />
            <Stat label="Dry Mass" value={formatNumber(dry, 2)} unit="kg" />
            <Stat label="Propellant" value={formatNumber(prop, 2)} unit="kg" accent="orange" />
            <Stat label="Total Impulse" value={formatNumber(impulse, 0)} unit="N·s" />
            <Stat
              label="Liftoff TWR"
              value={formatNumber(twr, 2)}
              accent={twr > 1 ? 'emerald' : 'rose'}
            />
            <Stat label="Diameter" value={formatNumber(diameter * 100, 1)} unit="cm" />
          </div>
          {twr <= 1 && design.components.some((c) => c.type === 'engine') && (
            <p className="mt-3 text-xs text-rose-400">
              Thrust-to-weight ratio is at or below 1 — this rocket won’t leave the pad. Add more thrust or remove mass.
            </p>
          )}
        </Card>

        <Card title="Stages" subtitle="Grouped by separation stage number, ascending">
          <div className="space-y-2">
            {stages.length === 0 && <p className="text-sm text-slate-500">No stages defined.</p>}
            {stages.map((stage, i) => (
              <div key={stage.stageNumber} className="rounded-lg bg-slate-950/50 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    Stage {i + 1} <span className="text-slate-500">(tag {stage.stageNumber})</span>
                  </span>
                  <span className="text-slate-400">{stage.engines.length} engine(s)</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-3 text-slate-400">
                  <span>Dry: {formatNumber(stage.dryMass, 2)} kg</span>
                  <span>Prop: {formatNumber(stage.propellantMass, 2)} kg</span>
                  <span>Burn: {formatNumber(stage.burnTime, 1)} s</span>
                  <span>Impulse: {formatNumber(stage.totalImpulse, 0)} N·s</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function ComponentRow({
  component,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  component: RocketComponent
  index: number
  total: number
  onChange: (updates: Partial<RocketComponent>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{COMPONENT_ICONS[component.type]}</span>
          <div className="grid gap-1 sm:grid-flow-col sm:items-end sm:gap-3">
            <TextField label="Name" value={component.name} onChange={(v) => onChange({ name: v })} />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-20">
            <NumberField label="Stage" step={1} min={1} value={component.stage} onChange={(v) => onChange({ stage: Math.max(1, Math.round(v)) })} />
          </div>
          <div className="w-24">
            <NumberField label="Mass" unit="kg" step={0.05} min={0} value={component.mass} onChange={(v) => onChange({ mass: v })} />
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" onClick={onMoveUp} disabled={index === 0}>
              ↑
            </Button>
            <Button variant="ghost" onClick={onMoveDown} disabled={index === total - 1}>
              ↓
            </Button>
            <Button variant="danger" onClick={onRemove}>
              ✕
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-3 border-t border-slate-800 pt-3">
        <ComponentFields component={component} onChange={onChange} />
      </div>
    </Card>
  )
}
