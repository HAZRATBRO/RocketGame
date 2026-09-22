# Rocket Trajectory Lab

A physics-based rocket design, simulation, and targeting game built with React, TypeScript, and Vite.

## Features

- **Trajectory Simulator** — launch a rocket at a chosen elevation angle and watch an animated
  flight profile, with altitude/velocity/Mach/dynamic-pressure charts and a full flight summary.
- **Components Creator** — build a rocket from nose cone, body tube, fins, engine, payload, and
  recovery components, with per-stage grouping for multi-stage designs and a live mass/TWR/impulse
  summary.
- **Targeting Map** — place targets on a 2D map, compute a firing solution (elevation + azimuth) via
  a numerical shooting method, and watch an animated launch with hit/miss feedback.
- **Physics Info** — a detailed, equation-by-equation reference (rendered with KaTeX) covering the
  variable-mass rocket equation, the Tsiolkovsky rocket equation, the standard atmosphere model,
  aerodynamic drag and the transonic drag rise, stability, the RK4 numerical integrator, and the
  targeting shooting method — all matching exactly what the simulator computes.

## Physics engine

The trajectory simulator (`src/physics/`) integrates a 6-state rocket trajectory (north/east/altitude
position and velocity) with classic 4th-order Runge-Kutta, under staged thrust, a layered
International Standard Atmosphere model, Mach-dependent aerodynamic drag, and altitude-varying
gravity. See the in-app Physics Info tab for the full derivation and equations.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # typecheck + production build
npm run lint     # oxlint
```
