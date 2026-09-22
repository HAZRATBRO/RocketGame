import type { ComponentType, NewRocketComponent, RocketComponent } from '../../physics/rocket'

function maxStage(existing: RocketComponent[]): number {
  return existing.reduce((max, c) => Math.max(max, c.stage), 1)
}

export function createDefaultComponent(type: ComponentType, existing: RocketComponent[]): NewRocketComponent {
  const stage = maxStage(existing)
  switch (type) {
    case 'nose-cone':
      return {
        type,
        name: 'Nose Cone',
        stage,
        mass: 0.7,
        shape: 'ogive',
        length: 0.4,
        diameter: 0.12,
        dragCoefficient: 0.3,
      }
    case 'body-tube':
      return { type, name: 'Body Tube', stage, mass: 1.5, length: 1.0, diameter: 0.12 }
    case 'fins':
      return { type, name: 'Fin Set', stage, mass: 0.5, count: 4, span: 0.1, rootChord: 0.18, tipChord: 0.07 }
    case 'payload':
      return { type, name: 'Payload', stage, mass: 1.0 }
    case 'recovery':
      return { type, name: 'Recovery System', stage, mass: 0.5 }
    case 'engine':
      return {
        type,
        name: 'Engine',
        stage,
        mass: 2.0,
        propellantMass: 3.0,
        burnTime: 3.0,
        avgThrust: 1500,
        thrustCurveShape: 'constant',
      }
  }
}

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  'nose-cone': 'Nose Cone',
  'body-tube': 'Body Tube',
  engine: 'Engine',
  fins: 'Fins',
  payload: 'Payload',
  recovery: 'Recovery',
}

export const COMPONENT_ICONS: Record<ComponentType, string> = {
  'nose-cone': '▲',
  'body-tube': '█',
  engine: '\u{1F525}',
  fins: '◇',
  payload: '■',
  recovery: '○',
}
