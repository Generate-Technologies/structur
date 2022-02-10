const calcLoadApplied = (
  dl_superimposed,
  live_load,
  facade_load,
  dead_load_clt
) => {
  const TRIBUTARY_WIDTH = 1;
  const total_load = dead_load_clt + dl_superimposed + live_load;
  const load_applied = total_load * TRIBUTARY_WIDTH + facade_load;
  return load_applied;
};

const calcElapp = (span, maj_el, maj_g) => {
  const Ks = 11.5; // CLT Handbook Ch.3 Table 2 - uniformly distributed load, pinned ends // 40

  // console.log("L40", Ks)

  const el = maj_el * 1000000;
  const g = maj_g * 1000000;

  return el / (1 + (Ks * el) / (g * (span * 12) ** 2));
};

const testBending = (load_applied, span, maj_f, CL, CD, CM, Ct) => {
  const m_max_applied = (load_applied * span ** 2) / 8.0;
  const m_allowable = maj_f * CL * CD * CM * Ct;
  return m_max_applied / m_allowable < 1.0;
};

const testShear = (load_applied, span, maj_v, CM, Ct) => {
  const v_applied = (load_applied * span) / 2;
  const v_allowable = CM * Ct * maj_v;
  return v_applied / v_allowable < 1.0;
};

const testVibration = (density, thickness, span, maj_el, maj_g) => {
  const specific_gravity = density / 0.015; // ?
  const area = thickness * 12;
  const Elapp = calcElapp(span, maj_el, maj_g);
  const freq =
    (2.188 / (2 * (span ^ 2))) * ((Elapp / (specific_gravity * area)) ^ 0.5);
  return freq >= 9;
};

const testFire = (
  dl_superimposed,
  live_load,
  facade_load,
  span,
  dead_load_clt,
  layers,
  CHAR_DEPTH,
  maj_f_b0
) => {
  const total_depth = layers
    .map((layer) => layer.depth)
    .reduce((d1, d2) => d1 + d2); // C14

  // console.log("C14", total_depth)

  const depth_left = total_depth - CHAR_DEPTH["2 hour"]; // L30

  // console.log("L30", depth_left)

  const TRIBUTARY_WIDTH = 1;

  // console.log("B19", dl_superimposed)
  // console.log("B20", live_load)

  const loads =
    (dead_load_clt * depth_left) / total_depth + dl_superimposed + live_load;

  // console.log("loads", loads)

  const next = loads * TRIBUTARY_WIDTH + facade_load * 1;

  // console.log("next", next)

  const m_acting_fire = (next * span ** 2) / 8; // L33

  // console.log("L33", m_acting_fire)

  const [CL, CD, CM, Ct] = [1, 1, 1, 1];

  const calc_layers_after_char = (layers, char_depth) => {
    const layers_out = [];

    for (let i = layers.length - 1; i >= 0; i--) {
      const current_layer = layers[i];

      const new_depth = current_layer.depth - char_depth;

      if (new_depth <= 0) {
        char_depth -= current_layer.depth;
      } else {
        const new_layer = { ...current_layer, depth: new_depth };
        layers_out.unshift(new_layer);
        char_depth = 0;
      }
    }

    return layers_out;
  };

  const layers_after_char = calc_layers_after_char(
    layers,
    CHAR_DEPTH["2 hour"]
  );

  const get_middle_layers_depth = (layers) => {
    if (layers.length == 2) {
      return 0;
    } else if (layers.length == 3) {
      return layers[0].depth;
    } else {
      return layers
        .slice(1, layers.length - 1)
        .map((layer) => layer.depth)
        .reduce((d1, d2) => d1 + d2);
    }
  };

  const top_layer_depth = layers_after_char[0].depth; // L17

  // console.log("L17", top_layer_depth)

  const middle_layers_depth = get_middle_layers_depth(layers_after_char); // L18

  // console.log("L18", middle_layers_depth)

  const bot_layer_depth = layers_after_char[layers_after_char.length - 1].depth; // L19

  // console.log("L19", bot_layer_depth)

  const total_depth_after_char = layers_after_char
    .map((layer) => layer.depth)
    .reduce((d1, d2) => d1 + d2); // L30

  // console.log("L30", total_depth_after_char)

  const sig_yi_hi =
    (top_layer_depth / 2) * top_layer_depth +
    (top_layer_depth + middle_layers_depth + bot_layer_depth / 2) *
      bot_layer_depth; // L21

  // console.log("L21", sig_yi_hi)

  const sig_hi = top_layer_depth + bot_layer_depth; // L22

  // console.log("L22", sig_hi)

  const y_bar = sig_yi_hi / sig_hi; // L23

  // console.log("L23", y_bar)

  const i_eff =
    (12 * top_layer_depth ** 3) / 12 +
    (12 * bot_layer_depth ** 3) / 12 +
    12 * top_layer_depth * (y_bar - top_layer_depth / 2) ** 2 +
    12 *
      bot_layer_depth *
      (top_layer_depth + middle_layers_depth + bot_layer_depth / 2 - y_bar) **
        2; // L24

  // console.log("L24", i_eff)

  const S_eff = i_eff / (total_depth_after_char - y_bar); // L24

  // console.log("L25", S_eff)

  const FbS_eff = (S_eff * maj_f_b0) / 12; // L27

  // console.log("L27", FbS_eff)

  const m_allowable = 2.85 * CL * CD * CM * Ct * FbS_eff; // L32

  // console.log("L32", m_allowable)

  const shear_analogy_unity = m_acting_fire / m_allowable; // L34

  // console.log("L34", shear_analogy_unity)

  const time_to_burn_through = 60 * ((total_depth - 0.6) / 1.5) ** 1.23 + 17; // L35

  // console.log("L35", time_to_burn_through)

  const time_to_thermal_separation = 0.85 * time_to_burn_through; // L36

  // console.log("L36", time_to_thermal_separation)

  const REQUIRED_FIRE_RATING = 120; // L37

  // console.log("L37", REQUIRED_FIRE_RATING)

  const fire_unity = REQUIRED_FIRE_RATING / time_to_thermal_separation; // L38

  // console.log("L38", fire_unity)

  return shear_analogy_unity <= 1.0 && fire_unity <= 1.0;
};

const testDeflection = (
  dead_load_clt,
  dl_superimposed,
  live_load,
  span,
  maj_el,
  maj_g
) => {
  const creep_factor = 2.0; // NDS 3.5.2 // L42

  const TRIBUTARY_WIDTH = 1; // B23

  const Elapp = calcElapp(span, maj_el, maj_g); // L41

  // console.log("L41", Elapp)

  const total_dead_load = dead_load_clt + dl_superimposed; // B21

  // const first = creep_factor*(5/384)*(B21*B23/12*(B25*12)^4)/(L41)

  // console.log("first", first)

  const total_deflection =
    (creep_factor *
      (5 / 384) *
      (((total_dead_load * TRIBUTARY_WIDTH) / 12) * (span * 12) ** 4)) /
      Elapp +
    ((5 / 384) * (((live_load * TRIBUTARY_WIDTH) / 12) * (span * 12) ** 4)) /
      Elapp; // L43

  // console.log("L43", total_deflection)

  const deflection_limit = (span * 12) / 240; // L44

  // console.log("L44", deflection_limit)

  const deflection_unity = total_deflection / deflection_limit; // L45

  // console.log("L45", deflection_unity)

  return deflection_unity <= 1.0;
};

// console.log(testDeflection(18.33, 30, 40, 16, 440.0, 0.92))

const runAllTests = (
  dl_superimposed,
  live_load,
  facade_load,
  span,
  dead_load_clt,
  density,
  thickness,
  maj_f,
  maj_el,
  maj_g,
  maj_v,
  maj_f_b0
) => {
  const load_applied = calcLoadApplied(
    dl_superimposed,
    live_load,
    facade_load,
    dead_load_clt
  );

  const [CL, CD, CM, Ct] = [1, 1, 1, 1];

  const layers = [
    { depth: 1.375, primary: true },
    { depth: 1.375, primary: false },
    { depth: 1.375, primary: true },
    { depth: 1.375, primary: false },
    { depth: 1.375, primary: true },
  ];

  const CHAR_DEPTH = { "1 hour": 1.9, "2 hour": 3.8 };

  const bools = [];

  const testOptions = [
    { label: "Bending", value: true },
    { label: "Shear", value: true },
    { label: "Vibration", value: true },
    { label: "Fire", value: true },
    { label: "Deflection", value: true },
  ];

  const tests = { label: "Run tests", items: testOptions };

  tests.items[tests.items.map((item) => item.label).indexOf("Bending")].value &&
    bools.push(testBending(load_applied, span, maj_f, CL, CD, CM, Ct));
  tests.items[tests.items.map((item) => item.label).indexOf("Shear")].value &&
    bools.push(testShear(load_applied, span, maj_v, CM, Ct));
  tests.items[tests.items.map((item) => item.label).indexOf("Vibration")]
    .value &&
    bools.push(testVibration(density, thickness, span, maj_el, maj_g));
  tests.items[tests.items.map((item) => item.label).indexOf("Fire")].value &&
    bools.push(
      testFire(
        dl_superimposed,
        live_load,
        facade_load,
        span,
        dead_load_clt,
        layers,
        CHAR_DEPTH,
        maj_f_b0
      )
    );
  tests.items[tests.items.map((item) => item.label).indexOf("Deflection")]
    .value &&
    bools.push(
      testDeflection(
        dead_load_clt,
        dl_superimposed,
        live_load,
        span,
        maj_el,
        maj_g
      )
    );

  return bools;
};

module.exports = { runAllTests };
