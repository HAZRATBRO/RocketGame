import { BlockMath, InlineMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import { Section } from './Section'

const TOC = [
  { id: 'variable-mass', label: 'Variable-Mass Motion' },
  { id: 'rocket-equation', label: 'Tsiolkovsky Rocket Equation' },
  { id: 'thrust', label: 'Thrust & Engine Model' },
  { id: 'atmosphere', label: 'Standard Atmosphere' },
  { id: 'fluid-dynamics', label: 'Fluid Dynamics & Drag' },
  { id: 'stability', label: 'Stability & Control' },
  { id: 'equations-of-motion', label: 'Equations of Motion' },
  { id: 'numerics', label: 'Numerical Integration (RK4)' },
  { id: 'targeting', label: 'Targeting: The Shooting Method' },
  { id: 'terrain-worlds', label: 'Terrain & World Physics' },
  { id: 'mirv', label: 'MIRV: Multi-Target Strikes' },
]

export function PhysicsInfo() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
      <nav className="hidden lg:block">
        <div className="sticky top-4 space-y-1 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Contents</p>
          {TOC.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="block rounded px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100">
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="space-y-4">
        <Section id="variable-mass" title="1. Newton's Second Law for a Variable-Mass System">
          <p>
            A rocket is not a rigid body of constant mass &mdash; it continuously ejects propellant, so the ordinary form
            of Newton's second law, <InlineMath math="F=ma" />, does not directly apply. The correct starting point is
            conservation of momentum for the combined system of rocket and expelled exhaust gas. This yields the
            Meshchersky (variable-mass) equation of motion:
          </p>
          <BlockMath math={String.raw`m \frac{d\vec{v}}{dt} = \vec{F}_{ext} + \vec{u}\,\frac{dm}{dt}`} />
          <p>
            Here <InlineMath math="m" /> is the instantaneous rocket mass, <InlineMath math="\vec{u}" /> is the exhaust
            velocity <em>relative to the rocket</em> (pointing aft), and <InlineMath math="dm/dt < 0" /> since mass is
            being lost. Defining the mass flow rate <InlineMath math="\dot m = -dm/dt > 0" /> and thrust
            <InlineMath math="\vec{T} = \vec{u}\,\dot m" />, this becomes the familiar form used throughout this
            simulator:
          </p>
          <BlockMath math={String.raw`m \frac{d\vec{v}}{dt} = \vec{T} + \vec{D} + m\vec{g}`} />
          <p>
            where <InlineMath math="\vec{D}" /> is aerodynamic drag and <InlineMath math="\vec g" /> is local
            gravitational acceleration. This is exactly the right-hand side integrated by the trajectory engine.
          </p>
        </Section>

        <Section id="rocket-equation" title="2. The Tsiolkovsky Rocket Equation">
          <p>
            Integrating the momentum equation with no external forces (vacuum, no gravity) gives the single most
            important relation in rocketry &mdash; the maximum velocity change a rocket can achieve from a given
            propellant load:
          </p>
          <BlockMath math={String.raw`\Delta v = v_e \ln\!\left(\frac{m_0}{m_f}\right) = I_{sp}\,g_0 \ln\!\left(\frac{m_0}{m_f}\right)`} />
          <p>
            where <InlineMath math="m_0" /> is initial (wet) mass, <InlineMath math="m_f" /> is final (dry) mass after
            burnout, <InlineMath math="v_e" /> is effective exhaust velocity, and specific impulse
            <InlineMath math="I_{sp}" /> is the standard efficiency metric for a rocket engine:
          </p>
          <BlockMath math={String.raw`I_{sp} = \frac{T}{\dot m\, g_0} = \frac{\int T\,dt}{m_p\, g_0}`} />
          <p>
            with <InlineMath math="m_p" /> the propellant mass consumed. In the Components Creator, each engine's
            specific impulse is derived automatically from its average thrust, burn time, and propellant mass using
            this exact relation.
          </p>
        </Section>

        <Section id="thrust" title="3. Thrust and the Engine Model">
          <p>The complete rocket thrust equation, including the pressure-imbalance term at the nozzle exit, is:</p>
          <BlockMath math={String.raw`T = \dot m\, v_e + (p_e - p_{amb})A_e`} />
          <p>
            The first term (momentum thrust) dominates for chemical rockets; the second (pressure thrust) is a smaller
            correction that vanishes when the nozzle is perfectly expanded. This simulator lets you specify each
            engine's thrust directly as an average value and a curve shape (constant, progressive, or regressive), which
            is how hobby and amateur solid-motor thrust curves are usually characterized. The instantaneous thrust is:
          </p>
          <BlockMath math={String.raw`T(t) = a + (b-a)\frac{t}{t_{burn}}, \qquad \frac{a+b}{2} = \bar T`} />
          <p>
            Because specific impulse is treated as constant over the burn, propellant mass depletion follows the same
            linear shape as thrust, letting the simulator compute remaining propellant mass in closed form (as a
            fraction of cumulative impulse) rather than integrating it as a separate state variable.
          </p>
        </Section>

        <Section id="atmosphere" title="4. The Standard Atmosphere">
          <p>
            Air density strongly affects drag and therefore trajectory shape, so the simulator implements the
            International Standard Atmosphere (ISA): a layered model of temperature vs. altitude, combined with the
            hydrostatic equation and the ideal gas law.
          </p>
          <BlockMath math={String.raw`p = \rho R T \qquad \text{(ideal gas law)}`} />
          <BlockMath math={String.raw`\frac{dp}{dh} = -\rho g \qquad \text{(hydrostatic equilibrium)}`} />
          <p>
            Within each ISA layer the temperature varies linearly with a fixed lapse rate <InlineMath math="L" />. For a
            non-isothermal layer (<InlineMath math="L \neq 0" />):
          </p>
          <BlockMath math={String.raw`T(h) = T_b + L(h-h_b), \qquad p(h) = p_b\left(\frac{T(h)}{T_b}\right)^{-g_0/(RL)}`} />
          <p>and for an isothermal layer (<InlineMath math="L = 0" />, such as the lower stratosphere):</p>
          <BlockMath math={String.raw`p(h) = p_b \exp\!\left(-\frac{g_0(h-h_b)}{RT_b}\right)`} />
          <p>Density and the local speed of sound then follow directly:</p>
          <BlockMath math={String.raw`\rho(h) = \frac{p(h)}{RT(h)}, \qquad a(h) = \sqrt{\gamma R T(h)}`} />
          <p>
            The simulator chains eight such layers from sea level up to ~85&nbsp;km, matching the real ISA table, and
            treats altitudes above that as a near-vacuum. Gravity itself also decreases with altitude following the
            inverse-square law <InlineMath math="g(h) = g_0\left(\frac{R_\oplus}{R_\oplus + h}\right)^2" />, which the
            integrator applies at every step.
          </p>
        </Section>

        <Section id="fluid-dynamics" title="5. Fluid Dynamics: Aerodynamic Drag">
          <p>
            As the rocket moves through air, it does work pushing fluid out of its way and shedding a turbulent wake.
            The resulting resistive force is characterized through the dynamic pressure of the oncoming flow:
          </p>
          <BlockMath math={String.raw`q = \tfrac{1}{2}\rho v^2`} />
          <p>and the aerodynamic drag force magnitude, opposing the velocity vector:</p>
          <BlockMath math={String.raw`D = q\, C_d\, A_{ref} = \tfrac{1}{2}\rho v^2 C_d A_{ref}`} />
          <p>
            where <InlineMath math="A_{ref}" /> is the rocket's reference cross-sectional area (from its largest
            airframe diameter) and <InlineMath math="C_d" /> is the drag coefficient, itself a function of the flow
            regime. The key dimensionless number governing that regime is the Mach number:
          </p>
          <BlockMath math={String.raw`M = \frac{v}{a}`} />
          <p>
            As <InlineMath math="M" /> approaches 1, shock waves begin forming on the airframe and nose cone, sharply
            increasing wave drag &mdash; the classic <em>transonic drag rise</em>. This simulator models that rise with
            a piecewise multiplier applied to a rocket's subsonic base <InlineMath math="C_d" />: roughly flat below
            Mach&nbsp;0.8, a steep climb to a peak near Mach&nbsp;1&ndash;1.3 (up to ~1.85&times; the subsonic value),
            then a gradual relaxation through the supersonic regime toward a hypersonic floor. The base coefficient
            itself is built from the nose cone shape and a per-fin drag increment set in the Components Creator, plus a
            fixed skin-friction allowance for the airframe. (A full computational treatment would also track Reynolds
            number, <InlineMath math="Re = \rho v L/\mu" />, to resolve laminar vs. turbulent boundary-layer friction
            &mdash; this tool uses a fixed empirical allowance instead.)
          </p>
        </Section>

        <Section id="stability" title="6. Stability &amp; Control">
          <p>
            For a rocket to fly straight rather than tumble, its center of pressure (CP) &mdash; the point where the net
            aerodynamic force effectively acts &mdash; must sit <em>behind</em> the center of gravity (CG) along the
            airframe. Any small pitch disturbance then generates a restoring aerodynamic moment (&ldquo;weathercock
            stability&rdquo;). The standard metric is the static margin, expressed in body diameters (calibers):
          </p>
          <BlockMath math={String.raw`\text{Static Margin} = \frac{x_{cp} - x_{cg}}{d}`} />
          <p>
            with 1&ndash;2 calibers of positive margin typically desired. Fin size and placement mostly control CP,
            while component placement (engine, payload, recovery gear) controls CG &mdash; this is exactly why the
            Components Creator lets you assign a mass and position to each part. Precisely locating CP from geometry
            (the Barrowman equations) requires integrating normal-force coefficients along the nose cone and fins; this
            tool keeps that analysis qualitative and instead focuses its numerical fidelity on the axial (thrust/drag)
            dynamics along the flight path.
          </p>
        </Section>

        <Section id="equations-of-motion" title="7. The Full Equations of Motion">
          <p>
            The simulator integrates a six-component state vector: position and velocity in a local North-East-Up
            frame, <InlineMath math="\vec{x} = (x_N, x_E, h,\, v_N, v_E, v_h)" />. Its derivative is:
          </p>
          <BlockMath math={String.raw`\dot{x}_N = v_N,\quad \dot{x}_E = v_E,\quad \dot h = v_h`} />
          <BlockMath
            math={String.raw`\dot{v}_N = \frac{T\cos\theta\cos\phi + D_N}{m}, \quad
\dot{v}_E = \frac{T\cos\theta\sin\phi + D_E}{m}, \quad
\dot{v}_h = \frac{T\sin\theta + D_h}{m} - g(h)`}
          />
          <p>
            where <InlineMath math="\theta" /> is the vehicle's pitch (elevation) angle and <InlineMath math="\phi" />{' '}
            its azimuth. The rocket flies a simple rigid pitch program: vertical through a short launch-rod phase, a
            linear pitch-over (&ldquo;gravity turn kick&rdquo;) to the commanded elevation angle, then a fixed attitude
            for the remainder of powered flight &mdash; approximating a finned, aerodynamically-stable vehicle without
            active guidance. Drag components <InlineMath math="(D_N, D_E, D_h)" /> always oppose the true velocity
            vector, not the thrust direction, so the two can diverge once winds or trajectory curvature are present.
            After burnout the vehicle simply coasts under drag and gravity until it descends back through the launch
            altitude.
          </p>
        </Section>

        <Section id="numerics" title="8. Numerical Integration: 4th-Order Runge-Kutta">
          <p>
            This system of ordinary differential equations has no closed-form solution once drag is included, so it is
            integrated numerically. The simulator uses classical 4th-order Runge-Kutta (RK4), which evaluates the
            derivative four times per step and combines them with a weighted average:
          </p>
          <BlockMath
            math={String.raw`k_1 = f(t,\,y), \quad
k_2 = f\!\left(t+\tfrac{h}{2},\, y+\tfrac{h}{2}k_1\right), \quad
k_3 = f\!\left(t+\tfrac{h}{2},\, y+\tfrac{h}{2}k_2\right), \quad
k_4 = f(t+h,\, y+h\,k_3)`}
          />
          <BlockMath math={String.raw`y_{n+1} = y_n + \frac{h}{6}\left(k_1 + 2k_2 + 2k_3 + k_4\right)`} />
          <p>
            RK4's local truncation error is <InlineMath math="O(h^5)" /> per step (global error{' '}
            <InlineMath math="O(h^4)" />), which is why a fixed, small timestep (20&nbsp;ms by default) is accurate
            enough to resolve the fast dynamics of powered flight without adaptive step control.
          </p>
        </Section>

        <Section id="targeting" title="9. Targeting: The Shooting Method">
          <p>
            To hit a target placed on the map, two angles must be found: azimuth and elevation. Azimuth is trivial
            &mdash; it's simply the compass bearing from the launch site to the target,{' '}
            <InlineMath math="\phi = \operatorname{atan2}(\Delta E,\, \Delta N)" />. Elevation is harder, because with
            drag present there is no algebraic formula for range as a function of launch angle the way there is for an
            idealized vacuum projectile.
          </p>
          <p>
            Instead, the targeting solver treats this as a root-finding problem on the function{' '}
            <InlineMath math="R(\theta)" /> &mdash; &ldquo;run the full trajectory simulation at elevation{' '}
            <InlineMath math="\theta" /> and report the horizontal landing distance.&rdquo; Since, like an ideal
            projectile, range generally rises with elevation angle up to some optimum (typically well below 45&deg;
            once drag is significant) and then falls, the solver:
          </p>
          <ol className="ml-5 list-decimal space-y-1">
            <li>Coarsely scans elevation angles from 5&deg; to 85&deg;, recording achieved range at each;</li>
            <li>Finds the first bracket where achieved range crosses the target distance;</li>
            <li>
              Refines the elevation within that bracket via bisection &mdash; halving the interval each iteration until
              it converges to within 0.01&deg;:
            </li>
          </ol>
          <BlockMath math={String.raw`\theta_{mid} = \frac{\theta_{lo}+\theta_{hi}}{2}, \qquad \text{keep the half where } \operatorname{sign}(R(\theta)-R_{target}) \text{ changes}`} />
          <p>
            If the target lies beyond the rocket's maximum achievable range, no bracket exists and the solver instead
            reports the best (maximum-range) angle along with how far short it falls. This is the same basic technique
            historically used in ballistic firing-solution tables, now computed live from the exact drag and atmosphere
            model above rather than a simplified range table.
          </p>
        </Section>

        <Section id="terrain-worlds" title="10. Terrain & World Physics">
          <p>
            Rather than a flat plane, the ground is a procedurally generated 2D height field{' '}
            <InlineMath math="h(x_E, x_N)" />, built from a small sum of sine-wave &ldquo;octaves&rdquo; at decreasing
            amplitude and increasing frequency &mdash; a cheap fractal-noise approximation of natural terrain that
            needs no external noise library:
          </p>
          <BlockMath math={String.raw`h(x_E,x_N) = h_0 + \sum_{i=1}^{N} A_i \sin\!\big(\vec k_i \cdot (x_E,x_N) + \varphi_i\big), \qquad A_i = A_0 \cdot 2^{-i}`} />
          <p>
            with each octave's direction <InlineMath math="\vec k_i" /> and phase <InlineMath math="\varphi_i" />{' '}
            drawn from a seeded random generator, so a given seed always reproduces the exact same landscape. A
            &ldquo;cliff&rdquo; world adds a smooth sigmoid step across a random line for a sharp escarpment; a
            &ldquo;flat&rdquo; world just dials the amplitude down to a few metres. The launch pad always sits exactly
            at <InlineMath math="h_0" />, whichever style is active. Critically, ground contact is checked against{' '}
            <InlineMath math="h(x_E,x_N)" /> at every integration step, not only at the end &mdash; so a rocket flown
            too flat into a hillside impacts the slope directly, rather than only being checked against a fixed
            reference altitude.
          </p>
          <p>
            Choosing a world doesn't just reskin the map: it scales the physics itself. Local gravity and air density
            both pick up world-specific multipliers on top of the same altitude-dependent Earth models described
            above:
          </p>
          <BlockMath math={String.raw`g_{world}(h) = g_{Earth}(h)\cdot k_g, \qquad \rho_{world}(h) = \rho_{Earth}(h)\cdot k_\rho \cdot \frac{T_{Earth}(h)}{T_{Earth}(h)+\Delta T}`} />
          <p>
            The Moon preset sets <InlineMath math="k_g \approx 0.166" /> and treats the atmosphere as a true vacuum
            (no drag, no dynamic pressure, no transonic drag rise at all) &mdash; the same rocket that barely clears
            its own launch tower on Earth can suddenly achieve enormous range. Mars sets{' '}
            <InlineMath math="k_g \approx 0.379" /> with a thin, cold CO&#8322; stand-in atmosphere (
            <InlineMath math="k_\rho \approx 0.012" />, <InlineMath math="\Delta T \approx -60\text{K}" />). Mountain
            and desert worlds keep Earth gravity but change the launch altitude and temperature offset, which feeds
            back into the same ISA density formula from the atmosphere section &mdash; a high, cold mountain pad
            genuinely flies differently than a hot desert one because the air really is thinner and less dense there.
          </p>
        </Section>

        <Section id="mirv" title="11. MIRV: Multi-Target Strikes">
          <p>
            A MIRV (Multiple Independently-targetable Reentry Vehicle) trades one single-target shot for several
            simultaneous ones. The simulator models this in two phases with a hard physical distinction between them:
          </p>
          <ol className="ml-5 list-decimal space-y-1">
            <li>
              <strong>Shared boost.</strong> One powered trajectory launches toward the target cluster's centroid,
              exactly like a normal single-target flight, integrated with the same staged-thrust RK4 model used
              everywhere else in this simulator.
            </li>
            <li>
              <strong>Bus separation at burnout.</strong> Rather than waiting for apogee &mdash; where, on a steep
              trajectory, vertical velocity has bled down toward zero and there is little energy left to redirect
              &mdash; separation happens the moment the final stage burns out, while the vehicle still carries most of
              its terminal speed. This is deliberately close to how real post-boost vehicles operate: they separate
              with substantial kinetic energy still in hand, specifically so they have a meaningful maneuvering budget.
            </li>
          </ol>
          <p>
            From the release state <InlineMath math="(\vec x_r, \vec v_r)" /> (position and velocity captured directly
            from the shared boost's own simulation samples), each warhead solves its own miniature shooting problem:
            speed is fixed at <InlineMath math="\lVert \vec v_r \rVert" />, azimuth is aimed exactly at that warhead's
            own target as seen <em>from the release point</em> (not from the launch pad &mdash; this correction matters
            because separation happens well off to the side of the pad), and only the elevation angle is free:
          </p>
          <BlockMath math={String.raw`\text{find } \theta_i \text{ such that } \big\lVert \text{Coast}(\vec x_r, \vec v_r, \theta_i) - \vec x_r\big\rVert = d_i`} />
          <p>
            where <InlineMath math="d_i" /> is target <InlineMath math="i" />'s distance from the release point and{' '}
            <InlineMath math="\text{Coast}(\cdot)" /> is an unpowered RK4 integration under drag, gravity, and terrain
            collision &mdash; identical physics to the main simulator, just with thrust set to zero and a small,
            streamlined reentry-vehicle drag profile in place of the full airframe's. The same coarse-scan-then-bisect
            shooting method from the section above solves for <InlineMath math="\theta_i" /> independently for every
            warhead, which is why some can hit while others miss: each one is its own self-contained targeting
            problem, constrained only by how much energy the shared boost handed it at separation. Warhead mass is the
            design's total payload mass split evenly across however many targets are selected (up to four).
          </p>
        </Section>
      </div>
    </div>
  )
}
