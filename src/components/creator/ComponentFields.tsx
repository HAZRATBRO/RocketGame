import { NumberField, SelectField } from '../ui/fields'
import type { RocketComponent } from '../../physics/rocket'

export function ComponentFields({
  component,
  onChange,
}: {
  component: RocketComponent
  onChange: (updates: Partial<RocketComponent>) => void
}) {
  switch (component.type) {
    case 'nose-cone':
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SelectField
            label="Shape"
            value={component.shape}
            onChange={(v) => onChange({ shape: v })}
            options={[
              { value: 'conical', label: 'Conical' },
              { value: 'ogive', label: 'Ogive' },
              { value: 'elliptical', label: 'Elliptical' },
            ]}
          />
          <NumberField label="Length" unit="m" step={0.05} value={component.length} onChange={(v) => onChange({ length: v })} />
          <NumberField label="Diameter" unit="m" step={0.01} value={component.diameter} onChange={(v) => onChange({ diameter: v })} />
          <NumberField label="Base Cd" step={0.01} min={0} value={component.dragCoefficient} onChange={(v) => onChange({ dragCoefficient: v })} />
        </div>
      )
    case 'body-tube':
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <NumberField label="Length" unit="m" step={0.05} value={component.length} onChange={(v) => onChange({ length: v })} />
          <NumberField label="Diameter" unit="m" step={0.01} value={component.diameter} onChange={(v) => onChange({ diameter: v })} />
        </div>
      )
    case 'fins':
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <NumberField label="Count" step={1} min={2} max={8} value={component.count} onChange={(v) => onChange({ count: v })} />
          <NumberField label="Span" unit="m" step={0.01} value={component.span} onChange={(v) => onChange({ span: v })} />
          <NumberField label="Root Chord" unit="m" step={0.01} value={component.rootChord} onChange={(v) => onChange({ rootChord: v })} />
          <NumberField label="Tip Chord" unit="m" step={0.01} value={component.tipChord} onChange={(v) => onChange({ tipChord: v })} />
        </div>
      )
    case 'payload':
    case 'recovery':
      return <p className="text-xs text-slate-500">Adds fixed mass only — no aerodynamic or propulsive effect.</p>
    case 'engine':
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <NumberField
            label="Propellant Mass"
            unit="kg"
            step={0.1}
            min={0}
            value={component.propellantMass}
            onChange={(v) => onChange({ propellantMass: v })}
          />
          <NumberField label="Burn Time" unit="s" step={0.1} min={0.1} value={component.burnTime} onChange={(v) => onChange({ burnTime: v })} />
          <NumberField label="Avg Thrust" unit="N" step={10} min={0} value={component.avgThrust} onChange={(v) => onChange({ avgThrust: v })} />
          <SelectField
            label="Thrust Curve"
            value={component.thrustCurveShape}
            onChange={(v) => onChange({ thrustCurveShape: v })}
            options={[
              { value: 'constant', label: 'Constant' },
              { value: 'progressive', label: 'Progressive' },
              { value: 'regressive', label: 'Regressive' },
            ]}
          />
        </div>
      )
  }
}
