// ============================================================
// Clinical Field Registry — Single Source of Truth (Phase 6)
//
// Owns every clinical field's identity:
//   - canonicalKey      → post-rename field key (used everywhere)
//   - legacyKeys        → accepted legacy field keys (resolved at read time)
//   - label             → human-readable label
//   - anchors           → Spanish lexical anchors for parser positioning
//   - defaultText       → seed text when no dictation covers the field
//   - displayOrder      → ordering for narrative emission
//   - dictationRewrites → organ-specific post-dictation corrections
//
// All consumers MUST go through this registry instead of declaring
// field metadata inline. To rename a field, add a field, or change
// a default, edit ONLY this file.
//
// Backward compatibility: legacy field keys (e.g., `higado_arquitectura`)
// are accepted as input and resolved via `getCanonicalFieldKey` before
// reaching the Clinical Rules Engine.
//
// Run from Node:
//   npx vite-node src/utils/clinicalFieldRegistryTests.js
// ============================================================

// ── Dictation post-rewrites (cross-organ) ────────────────────
//
// Applied to ALL text values, regardless of organ.
// These are corrections for typos / Whisper transcription artifacts
// that the LLM cannot reliably fix on its own.
const GLOBAL_DICTATION_REWRITES = [
  [/\bepatomegalia\b/gi, 'hepatomegalia'],
  [/\bvaso\b/gi, 'bazo'],
  [/\blitros\b/gi, 'litos'],
  [/\blistos\b/gi, 'litos'],
  [/\benema\b/gi, 'edema'],
  [/\bhiperecogenico\b/gi, 'hiperecogénico'],
  [/\bhipoecogenico\b/gi, 'hipoecogénico'],
  [/\bparenquima\b/gi, 'parénquima'],
  [/\bpelvico\b/gi, 'pélvico'],
  [/\bpelvica\b/gi, 'pélvica'],
];

// ── Megalia expansions (per organ) ───────────────────────────
//
// "megalia" is dictated as a fragment; expand to the full clinical term
// based on the organ context.
export const MEGALIA_EXPANSIONS = {
  bazo: 'Esplenomegalia',
  higado: 'Hepatomegalia',
  rinon: 'Nefromegalia',
  rinones: 'Nefromegalia',
  pancreas: 'Pancreatomegalia',
  adrenales: 'Adrenomegalia',
  adrenal: 'Adrenomegalia',
  adrenal_derecha: 'Adrenomegalia',
  adrenal_izquierda: 'Adrenomegalia',
  estomago: 'Gastromegalia',
  intestino: 'Enteromegalia',
  linfonodos: 'Linfadenomegalia',
  vejiga: 'Cistomegalia',
  prostata: 'Prostatomegalia',
  corazon: 'Cardiomegalia',
};

// ── Organ metadata (Phase 7) ────────────────────────────────
//
// Declarative per-organ metadata. The Registry stays 100% data-only
// — no anonymous functions, only strings and numbers. Visibility
// and variant-resolution predicates live in `clinicalVisibilityRules.js`
// and are referenced by name from here.
//
// OrganMeta = {
//   organDisplayOrder:  number  // position in document / preview
//   visibilityRule:     string  // ref into VISIBILITY_RULES ('always' | 'canine_male_only' | ...)
//   paragraphSplit:     number | null  // 0..1, fraction of fields for first paragraph (intestino = 0.5)
//   variants:           string | null  // ref into VARIANT_RESOLVERS ('kidneys' | 'adrenals' | ...)
// }
//
// Only TOP-LEVEL display organs are listed here. Variant children
// (rinon_derecho, rinon_izquierdo, adrenal_derecha, adrenal_izquierda)
// are referenced internally by the variant resolvers and never appear
// at the document top level.
export const ORGAN_META = {
  vejiga:     { organDisplayOrder: 1,  visibilityRule: 'always',           paragraphSplit: null, variants: null },
  prostata:   { organDisplayOrder: 2,  visibilityRule: 'canine_male_only', paragraphSplit: null, variants: null },
  rinones:    { organDisplayOrder: 3,  visibilityRule: 'always',           paragraphSplit: null, variants: 'kidneys' },
  bazo:       { organDisplayOrder: 4,  visibilityRule: 'always',           paragraphSplit: null, variants: null },
  estomago:   { organDisplayOrder: 5,  visibilityRule: 'always',           paragraphSplit: null, variants: null },
  higado:     { organDisplayOrder: 6,  visibilityRule: 'always',           paragraphSplit: null, variants: null },
  vesicula:   { organDisplayOrder: 7,  visibilityRule: 'always',           paragraphSplit: null, variants: null },
  intestino:  { organDisplayOrder: 8,  visibilityRule: 'always',           paragraphSplit: 0.5,  variants: null },
  pancreas:   { organDisplayOrder: 9,  visibilityRule: 'always',           paragraphSplit: null, variants: null },
  adrenales:  { organDisplayOrder: 10, visibilityRule: 'always',           paragraphSplit: null, variants: 'adrenals' },
  linfonodos: { organDisplayOrder: 11, visibilityRule: 'always',           paragraphSplit: null, variants: null },
};

// ── Organ display labels ─────────────────────────────────────
//
// Used by DOCX, renderEngine, prompts, and PersonalizarTab as the
// human-readable label for each canonical organ id.
export const ORGAN_LABELS = {
  vejiga: 'Vejiga',
  prostata: 'Próstata',
  rinones: 'Riñones',
  rinon_derecho: 'Riñón Derecho',
  rinon_izquierdo: 'Riñón Izquierdo',
  bazo: 'Bazo',
  estomago: 'Estómago',
  higado: 'Hígado',
  vesicula: 'Vesícula Biliar',
  intestino: 'Intestino',
  pancreas: 'Páncreas',
  adrenales: 'Adrenales',
  adrenal_derecha: 'Adrenal Derecha',
  adrenal_izquierda: 'Adrenal Izquierda',
  linfonodos: 'Linfonodos',
};

// ── Field registry: organId → fieldKey → FieldMeta ───────────
//
// FieldMeta = {
//   canonicalKey:    string  // post-rename canonical key
//   legacyKeys:      string[] // legacy keys that resolve to this entry
//   label:           string  // human-readable label
//   description:     string  // anatomical scope used to disambiguate LLM
//                            // classification (sent as JSON Schema
//                            // description to the model). Falls back to
//                            // `label` when not present.
//   anchors:         string[] // Spanish lexical anchors (parser positioning)
//   defaultText:     string  // seed text when no dictation covers the field
//   displayOrder:    number  // ordering for narrative emission
//   type:            'text' // type tag (currently always 'text')
//   dictationRewrites: Array<[RegExp, string]> // organ-specific corrections
// }

export const CLINICAL_FIELD_REGISTRY = {
  vejiga: {
    vejiga_repleccion: {
      canonicalKey: 'vejiga_repleccion',
      legacyKeys: [],
      label: 'Replección',
      anchors: ['replecion', 'replección', 'llenado', 'pletorica', 'pletórica', 'distendida', 'vacia', 'vacía'],
      defaultText: 'Vejiga semi pletórica',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    vejiga_contenido: {
      canonicalKey: 'vejiga_contenido',
      legacyKeys: [],
      label: 'Contenido',
      anchors: ['contenido', 'anecoico', 'homogeneo', 'homogéneo', 'sedimento', 'ecos'],
      defaultText: 'con contenido anecoico, homogéneo',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
    vejiga_pared: {
      canonicalKey: 'vejiga_pared',
      legacyKeys: [],
      label: 'Pared',
      anchors: ['pared', 'paredes', 'bordes internos', 'grosor', 'mucosa'],
      defaultText: 'pared de bordes internos regulares y grosor conservado',
      displayOrder: 3,
      type: 'text',
      dictationRewrites: [],
    },
  },

  prostata: {
    prostata_forma: {
      canonicalKey: 'prostata_forma',
      legacyKeys: [],
      label: 'Forma',
      anchors: ['forma', 'ovalada', 'bilobulada', 'asimetrica', 'asimétrica', 'simetrica', 'simétrica'],
      defaultText: 'Aspecto ovalada, bilobulada',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    prostata_tamano: {
      canonicalKey: 'prostata_tamano',
      legacyKeys: [],
      label: 'Tamaño',
      anchors: ['tamaño', 'aumentada', 'disminuida', 'rango'],
      defaultText: 'tamaño dentro de rango',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
    prostata_ecogenicidad: {
      canonicalKey: 'prostata_ecogenicidad',
      legacyKeys: [],
      label: 'Ecogenicidad',
      anchors: ['ecogenicidad', 'ecoica', 'hipoecoica', 'hiperecogenica', 'hiperecogénica'],
      defaultText: 'hipoecoica',
      displayOrder: 3,
      type: 'text',
      dictationRewrites: [],
    },
    prostata_homogeneidad: {
      canonicalKey: 'prostata_homogeneidad',
      legacyKeys: [],
      label: 'Homogeneidad',
      anchors: ['homogenea', 'homogénea', 'heterogenea', 'heterogénea'],
      defaultText: 'y homogénea',
      displayOrder: 4,
      type: 'text',
      dictationRewrites: [],
    },
  },

  rinon_derecho: {
    rinon_derecho_forma: {
      canonicalKey: 'rinon_derecho_forma',
      legacyKeys: [],
      label: 'Forma',
      anchors: ['riñón derecho', 'rinon derecho', 'derecho forma', 'derecho de forma'],
      defaultText: 'Imagen renal derecha de aspecto ovalado',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_derecho_tamano: {
      canonicalKey: 'rinon_derecho_tamano',
      legacyKeys: [],
      label: 'Tamaño',
      anchors: ['derecho tamaño', 'derecho de tamaño', 'tamaño derecho'],
      defaultText: 'tamaño dentro de rango',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_derecho_bordes: {
      canonicalKey: 'rinon_derecho_bordes',
      legacyKeys: [],
      label: 'Bordes',
      anchors: ['derecho bordes', 'derecho de bordes', 'bordes derecho'],
      defaultText: 'bordes regulares',
      displayOrder: 3,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_derecho_corteza_ecogenicidad: {
      canonicalKey: 'rinon_derecho_corteza_ecogenicidad',
      legacyKeys: [],
      label: 'Corteza/Ecogenicidad',
      anchors: ['derecho corteza', 'corteza derecha', 'derecho ecogenicidad'],
      defaultText: 'corteza ecogenicidad conservada',
      displayOrder: 4,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_derecho_diferenciacion_corticomedular: {
      canonicalKey: 'rinon_derecho_diferenciacion_corticomedular',
      legacyKeys: [],
      label: 'Diferenciación Corticomedular',
      anchors: ['derecho diferenciacion', 'derecho cortico medular', 'diferenciacion derecho'],
      defaultText: 'diferenciación cortico medular bien definida',
      displayOrder: 5,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_derecho_relacion_corticomedular: {
      canonicalKey: 'rinon_derecho_relacion_corticomedular',
      legacyKeys: [],
      label: 'Relación Corticomedular',
      anchors: ['derecho relacion', 'relacion derecho', 'relación cortico medular'],
      defaultText: 'relación cortico medular adecuada',
      displayOrder: 6,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_derecho_compromiso_pelvico: {
      canonicalKey: 'rinon_derecho_compromiso_pelvico',
      legacyKeys: [],
      label: 'Compromiso Pélvico',
      anchors: ['derecho pelvis', 'compromiso derecho', 'derecho compromiso'],
      defaultText: 'sin compromiso pélvico',
      displayOrder: 7,
      type: 'text',
      dictationRewrites: [],
    },
  },

  rinon_izquierdo: {
    rinon_izquierdo_forma: {
      canonicalKey: 'rinon_izquierdo_forma',
      legacyKeys: [],
      label: 'Forma',
      anchors: ['riñón izquierdo', 'rinon izquierdo', 'izquierdo forma', 'izquierdo de forma'],
      defaultText: 'Imagen renal izquierda de aspecto ovalado',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_izquierdo_tamano: {
      canonicalKey: 'rinon_izquierdo_tamano',
      legacyKeys: [],
      label: 'Tamaño',
      anchors: ['izquierdo tamaño', 'izquierdo de tamaño', 'tamaño izquierdo'],
      defaultText: 'tamaño dentro de rango',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_izquierdo_bordes: {
      canonicalKey: 'rinon_izquierdo_bordes',
      legacyKeys: [],
      label: 'Bordes',
      anchors: ['izquierdo bordes', 'izquierdo de bordes', 'bordes izquierdo'],
      defaultText: 'bordes regulares',
      displayOrder: 3,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_izquierdo_corteza_ecogenicidad: {
      canonicalKey: 'rinon_izquierdo_corteza_ecogenicidad',
      legacyKeys: [],
      label: 'Corteza/Ecogenicidad',
      anchors: ['izquierdo corteza', 'corteza izquierda', 'izquierdo ecogenicidad'],
      defaultText: 'corteza ecogenicidad conservada',
      displayOrder: 4,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_izquierdo_diferenciacion_corticomedular: {
      canonicalKey: 'rinon_izquierdo_diferenciacion_corticomedular',
      legacyKeys: [],
      label: 'Diferenciación Corticomedular',
      anchors: ['izquierdo diferenciacion', 'izquierdo cortico medular'],
      defaultText: 'diferenciación cortico medular bien definida',
      displayOrder: 5,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_izquierdo_relacion_corticomedular: {
      canonicalKey: 'rinon_izquierdo_relacion_corticomedular',
      legacyKeys: [],
      label: 'Relación Corticomedular',
      anchors: ['izquierdo relacion', 'relacion izquierdo', 'relación cortico medular'],
      defaultText: 'relación cortico medular adecuada',
      displayOrder: 6,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_izquierdo_compromiso_pelvico: {
      canonicalKey: 'rinon_izquierdo_compromiso_pelvico',
      legacyKeys: [],
      label: 'Compromiso Pélvico',
      anchors: ['izquierdo pelvis', 'compromiso izquierdo', 'izquierdo compromiso'],
      defaultText: 'sin compromiso pélvico',
      displayOrder: 7,
      type: 'text',
      dictationRewrites: [],
    },
  },

  rinones: {
    rinon_forma: {
      canonicalKey: 'rinon_forma',
      legacyKeys: ['rinones_forma'],
      label: 'Forma',
      anchors: ['ambas imágenes renales', 'ambos riñones', 'imagenes renales', 'riñones forma'],
      defaultText: 'Ambas imágenes renales de aspecto ovalado',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_tamano: {
      canonicalKey: 'rinon_tamano',
      legacyKeys: ['rinones_tamano'],
      label: 'Tamaño',
      anchors: ['tamaño renal', 'tamaño de los riñones'],
      defaultText: 'tamaño dentro de rango',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_bordes: {
      canonicalKey: 'rinon_bordes',
      legacyKeys: ['rinones_bordes'],
      label: 'Bordes',
      anchors: ['bordes renales', 'bordes de los riñones'],
      defaultText: 'bordes regulares',
      displayOrder: 3,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_corteza_ecogenicidad: {
      canonicalKey: 'rinon_corteza_ecogenicidad',
      legacyKeys: ['rinones_corteza_ecogenicidad'],
      label: 'Corteza/Ecogenicidad',
      anchors: ['corteza renal', 'corteza de los riñones'],
      defaultText: 'corteza ecogenicidad conservada',
      displayOrder: 4,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_diferenciacion_corticomedular: {
      canonicalKey: 'rinon_diferenciacion_corticomedular',
      legacyKeys: ['rinones_diferenciacion_corticomedular'],
      label: 'Diferenciación Corticomedular',
      anchors: ['diferenciacion renal', 'diferenciacion cortico medular'],
      defaultText: 'diferenciación cortico medular bien definida',
      displayOrder: 5,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_relacion_corticomedular: {
      canonicalKey: 'rinon_relacion_corticomedular',
      legacyKeys: ['rinones_relacion_corticomedular'],
      label: 'Relación Corticomedular',
      anchors: ['relacion cortico medular', 'relación cortico medular'],
      defaultText: 'relación cortico medular adecuada',
      displayOrder: 6,
      type: 'text',
      dictationRewrites: [],
    },
    rinon_compromiso_pelvico: {
      canonicalKey: 'rinon_compromiso_pelvico',
      legacyKeys: ['rinones_compromiso_pelvico'],
      label: 'Compromiso Pélvico',
      anchors: ['compromiso pelvico', 'compromiso pélvico', 'sin compromiso'],
      defaultText: 'sin compromiso pélvico',
      displayOrder: 7,
      type: 'text',
      dictationRewrites: [],
    },
  },

  bazo: {
    bazo_tamano_forma: {
      canonicalKey: 'bazo_tamano_forma',
      legacyKeys: [],
      label: 'Tamaño y Forma',
      anchors: ['bazo tamaño', 'tamaño del bazo', 'esplenica', 'esplénica', 'imagen esplénica'],
      defaultText: 'Imagen esplénica de tamaño y forma normales',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    bazo_margenes: {
      canonicalKey: 'bazo_margenes',
      legacyKeys: [],
      label: 'Márgenes',
      anchors: ['bazo margenes', 'márgenes del bazo', 'bordes del bazo'],
      defaultText: 'márgenes lisos',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
    bazo_parenquima: {
      canonicalKey: 'bazo_parenquima',
      legacyKeys: ['bazo_arquitectura'],
      label: 'Parénquima',
      anchors: ['bazo parenquima', 'parénquima del bazo', 'bazo arquitectura', 'arquitectura del bazo', 'parénquima'],
      defaultText: 'y parénquima conservado',
      displayOrder: 3,
      type: 'text',
      dictationRewrites: [],
    },
  },

  estomago: {
    estomago_distension: {
      canonicalKey: 'estomago_distension',
      legacyKeys: [],
      label: 'Distensión',
      anchors: ['estómago distendido', 'estomago distendido', 'distension gastrica', 'distensión gástrica', 'semi distendido'],
      defaultText: 'Semi distendido',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    estomago_contenido: {
      canonicalKey: 'estomago_contenido',
      legacyKeys: [],
      label: 'Contenido',
      anchors: ['contenido gastrico', 'contenido gástrico', 'contenido alimenticio', 'gas'],
      defaultText: 'con contenido alimenticio y gas',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
    estomago_paredes: {
      canonicalKey: 'estomago_paredes',
      legacyKeys: [],
      label: 'Paredes',
      anchors: ['paredes gastricas', 'paredes gástricas', 'pared del estómago', 'grosor conservado'],
      defaultText: 'con paredes estratificadas de grosor conservado',
      displayOrder: 3,
      type: 'text',
      dictationRewrites: [],
    },
  },

  higado: {
    higado_tamano: {
      canonicalKey: 'higado_tamano',
      legacyKeys: [],
      label: 'Tamaño',
      anchors: ['hígado tamaño', 'higado tamaño', 'tamaño hepatico', 'tamaño hepático', 'imagen hepática'],
      defaultText: 'Imagen hepática de tamaño normal',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    higado_margenes: {
      canonicalKey: 'higado_margenes',
      legacyKeys: [],
      label: 'Márgenes',
      anchors: ['márgenes hepaticos', 'márgenes hepáticos', 'márgenes del hígado', 'margenes lisos'],
      defaultText: 'de márgenes lisos',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
    higado_bordes: {
      canonicalKey: 'higado_bordes',
      legacyKeys: [],
      label: 'Bordes',
      anchors: ['bordes hepaticos', 'bordes hepáticos', 'bordes aguzados', 'bordes del hígado'],
      defaultText: 'y bordes aguzados',
      displayOrder: 3,
      type: 'text',
      dictationRewrites: [],
    },
    higado_ecogenicidad: {
      canonicalKey: 'higado_ecogenicidad',
      legacyKeys: [],
      label: 'Ecogenicidad',
      description:
        'Características ecogénicas del parénquima hepático. Incluye: ' +
        'ecogenicidad global (hipoecoica / hiperecogénica / isoecoica / ' +
        'heterogénea / homogénea), textura o granulado (fino / grueso / ' +
        'heterogéneo) y rasgos parenquimatosos asociados tales como ' +
        'mayor demarcación de paredes portales, realce de la trama ' +
        'portal, patrón en cielo estrellado (starry sky) y otros hallazgos ' +
        'parenquimatosos difusos. Reservar SIEMPRE para estas menciones. ' +
        'NO usar para vasculatura ni flujo Doppler (eso es higado_patron_vascular).',
      anchors: ['ecogenicidad', 'hipoecoica', 'hiperecogenica', 'hiperecogénica', 'ecoica', 'demarcacion de paredes portales', 'demarcación de paredes portales', 'cielo estrellado', 'starry sky'],
      defaultText: 'Ecogenicidad hipoecoica de granulado grueso',
      displayOrder: 4,
      type: 'text',
      dictationRewrites: [],
    },
    higado_granulado: {
      canonicalKey: 'higado_granulado',
      legacyKeys: [],
      label: 'Granulado',
      description:
        'Textura o granulado del parénquima hepático (fino, grueso, ' +
        'heterogéneo). Es una subcategoría de ecogenicidad cuando el ' +
        'usuario dicta explícitamente el tipo de granulado por separado ' +
        '("granulado grueso", "de granulado fino"). NO usar para hallazgos ' +
        'vasculares ni patrón portal.',
      anchors: ['granulado', 'granulado fino', 'granulado grueso'],
      defaultText: 'Ecogenicidad de granulado fino',
      displayOrder: 5,
      type: 'text',
      dictationRewrites: [],
    },
    higado_parenquima: {
      canonicalKey: 'higado_parenquima',
      legacyKeys: ['higado_arquitectura'],
      label: 'Parénquima',
      description:
        'Estado general del parénquima hepático (conservado, heterogéneo, ' +
        'alterado, nodular, con lesiones focales, etc.). NO incluir aquí ' +
        'mención de paredes portales ni de vasculatura — esos hallazgos ' +
        'van en higado_ecogenicidad o higado_patron_vascular respectivamente.',
      anchors: ['parénquima hepatico', 'parénquima hepático', 'higado arquitectura', 'arquitectura del hígado', 'parénquima'],
      defaultText: 'y parénquima conservado',
      displayOrder: 6,
      type: 'text',
      dictationRewrites: [],
    },
    higado_patron_vascular: {
      canonicalKey: 'higado_patron_vascular',
      legacyKeys: [],
      label: 'Patrón Vascular',
      description:
        'Patrón vascular hepático EXCLUSIVO: calibre y permeabilidad de ' +
        'vasos (vena porta, venas suprahepáticas, arteria hepática), ' +
        'flujo Doppler (normal, turbulento, hepatofugo, velocidad), ' +
        'shunts porto-sistémicos, dilatación de vena porta. NO usar para ' +
        'demarcación de paredes portales, parénquima, ecogenicidad, ' +
        'granulado ni patrón en cielo estrellado — esos hallazgos son ' +
        'parénquima/ecogenicidad.',
      anchors: ['patrón vascular', 'patron vascular', 'vascular hepatico', 'vascular hepático', 'doppler', 'vena porta', 'venas suprahepaticas'],
      defaultText: 'Patrón vascular conservado',
      displayOrder: 7,
      type: 'text',
      dictationRewrites: [],
    },
  },

  vesicula: {
    vesicula_distension: {
      canonicalKey: 'vesicula_distension',
      legacyKeys: [],
      label: 'Distensión',
      anchors: ['vesícula distendida', 'vesicula distendida', 'semi distendida', 'distension vesicular'],
      defaultText: 'Vesícula biliar semi distendida',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    vesicula_contenido: {
      canonicalKey: 'vesicula_contenido',
      legacyKeys: [],
      label: 'Contenido',
      anchors: ['contenido vesicular', 'contenido biliar', 'contenido anecoico'],
      defaultText: 'con contenido anecoico',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
    vesicula_bordes_internos: {
      canonicalKey: 'vesicula_bordes_internos',
      legacyKeys: [],
      label: 'Bordes Internos',
      anchors: ['bordes internos', 'bordes vesiculares', 'bordes regulares'],
      defaultText: 'bordes internos regulares',
      displayOrder: 3,
      type: 'text',
      dictationRewrites: [],
    },
    vesicula_pared: {
      canonicalKey: 'vesicula_pared',
      legacyKeys: [],
      label: 'Pared',
      anchors: ['pared vesicular', 'pared de la vesícula', 'grosor de pared'],
      defaultText: 'y pared de grosor conservados',
      displayOrder: 4,
      type: 'text',
      dictationRewrites: [],
    },
  },

  intestino: {
    intestino_duodeno_yeyuno_contenido: {
      canonicalKey: 'intestino_duodeno_yeyuno_contenido',
      legacyKeys: [],
      label: 'Duodeno/Yeyuno Contenido',
      anchors: ['duodeno', 'yeyuno', 'contenido intestinal', 'patrón alimenticio'],
      defaultText: 'Duodeno y yeyuno con contenido con predominio de patrón alimenticio',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    intestino_duodeno_yeyuno_grosor: {
      canonicalKey: 'intestino_duodeno_yeyuno_grosor',
      legacyKeys: [],
      label: 'Grosor',
      anchors: ['grosor intestinal', 'grosor conservado'],
      defaultText: 'con grosor conservado',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
    intestino_duodeno_yeyuno_paredes: {
      canonicalKey: 'intestino_duodeno_yeyuno_paredes',
      legacyKeys: [],
      label: 'Paredes',
      anchors: ['paredes intestinales', 'paredes estratificadas'],
      defaultText: 'y paredes estratificadas',
      displayOrder: 3,
      type: 'text',
      dictationRewrites: [],
    },
    intestino_duodeno_yeyuno_estratificado: {
      canonicalKey: 'intestino_duodeno_yeyuno_estratificado',
      legacyKeys: [],
      label: 'Estratificación',
      anchors: ['estratificacion', 'estratificación', 'estratificado'],
      defaultText: 'con estratificación conservada',
      displayOrder: 4,
      type: 'text',
      dictationRewrites: [],
    },
    intestino_peristaltismo: {
      canonicalKey: 'intestino_peristaltismo',
      legacyKeys: [],
      label: 'Peristaltismo',
      anchors: ['peristaltismo', 'movimientos peristalticos', 'peristálticos'],
      defaultText: 'peristaltismo normal',
      displayOrder: 5,
      type: 'text',
      dictationRewrites: [],
    },
    intestino_colon_contenido: {
      canonicalKey: 'intestino_colon_contenido',
      legacyKeys: [],
      label: 'Colon Contenido',
      anchors: ['colon', 'contenido fecal', 'contenido colónico'],
      defaultText: 'Colon con contenido fecal',
      displayOrder: 6,
      type: 'text',
      dictationRewrites: [],
      sentenceStart: true,
      capitalize: true,
    },
    intestino_colon_paredes: {
      canonicalKey: 'intestino_colon_paredes',
      legacyKeys: [],
      label: 'Colon Paredes',
      anchors: ['pared del colon', 'paredes colónicas', 'colon paredes'],
      defaultText: 'y paredes de grosor conservado',
      displayOrder: 7,
      type: 'text',
      dictationRewrites: [],
    },
  },

  pancreas: {
    pancreas_parenquima: {
      canonicalKey: 'pancreas_parenquima',
      legacyKeys: [],
      label: 'Parénquima',
      anchors: ['parénquima pancreatico', 'parénquima pancreático', 'páncreas conservado', 'pancreas conservado', 'páncreas'],
      defaultText: 'Páncreas conservado',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    pancreas_area_peripancreatica: {
      canonicalKey: 'pancreas_area_peripancreatica',
      legacyKeys: [],
      label: 'Área Peripancreática',
      anchors: ['área peripancreatica', 'área peripancreática', 'peri pancreatica', 'peri pancreática'],
      defaultText: 'área de proyección peri pancreática de aspecto conservado',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
  },

  adrenales: {
    adrenales_forma_tamano: {
      canonicalKey: 'adrenales_forma_tamano',
      legacyKeys: [],
      label: 'Forma y Tamaño',
      anchors: ['adrenales forma', 'adrenales tamaño', 'glándulas adrenales', 'forma y tamaño'],
      defaultText: 'Glándulas adrenales de forma y tamaño normales',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    adrenales_parenquima: {
      canonicalKey: 'adrenales_parenquima',
      legacyKeys: ['adrenales_arquitectura'],
      label: 'Parénquima',
      anchors: ['adrenales parenquima', 'adrenales arquitectura', 'parénquima adrenal'],
      defaultText: 'parénquima conservado',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
  },

  adrenal_derecha: {
    adrenal_derecha_forma_tamano: {
      canonicalKey: 'adrenal_derecha_forma_tamano',
      legacyKeys: [],
      label: 'Forma y Tamaño',
      anchors: ['adrenal derecha', 'derecha forma', 'derecha tamaño'],
      defaultText: 'Glándula adrenal derecha de forma y tamaño normales',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    adrenal_derecha_parenquima: {
      canonicalKey: 'adrenal_derecha_parenquima',
      legacyKeys: ['adrenal_derecha_arquitectura'],
      label: 'Parénquima',
      anchors: ['adrenal derecha parenquima', 'derecha arquitectura', 'parénquima derecha'],
      defaultText: 'parénquima conservado',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
  },

  adrenal_izquierda: {
    adrenal_izquierda_forma_tamano: {
      canonicalKey: 'adrenal_izquierda_forma_tamano',
      legacyKeys: [],
      label: 'Forma y Tamaño',
      anchors: ['adrenal izquierda', 'izquierda forma', 'izquierda tamaño'],
      defaultText: 'Glándula adrenal izquierda de forma y tamaño normales',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    adrenal_izquierda_parenquima: {
      canonicalKey: 'adrenal_izquierda_parenquima',
      legacyKeys: ['adrenal_izquierda_arquitectura'],
      label: 'Parénquima',
      anchors: ['adrenal izquierda parenquima', 'izquierda arquitectura', 'parénquima izquierda'],
      defaultText: 'parénquima conservado',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
  },

  linfonodos: {
    linfonodos_nodulos: {
      canonicalKey: 'linfonodos_nodulos',
      legacyKeys: ['linfonodos_regionales'],
      label: 'Nódulos',
      description:
        'Hallazgos descriptivos relativos a nódulos linfáticos o linfonodos, ' +
        'incluyendo su presencia, tamaño, morfología, ecogenicidad y otras ' +
        'alteraciones expresamente descritas en el dictado. No inferir ' +
        'diagnósticos ni asignar aquí líquido libre o masas abdominales.',
      anchors: ['linfonodos', 'nodulos linfaticos', 'nódulos linfáticos', 'nodulos comprometidos'],
      defaultText: 'No se observan nódulos linfáticos comprometidos.',
      displayOrder: 1,
      type: 'text',
      dictationRewrites: [],
    },
    linfonodos_liquido: {
      canonicalKey: 'linfonodos_liquido',
      legacyKeys: [
        'linfonodos_liquido_libre',
        'linfonodos_liquido_abdominal',
        'linfonodos_liquido_cavidad',
        'linfonodos_liquido_libre_cavidad',
      ],
      label: 'Líquido Libre',
      anchors: ['líquido libre', 'liquido libre', 'líquido abdominal'],
      defaultText: 'No se observa líquido libre',
      displayOrder: 2,
      type: 'text',
      dictationRewrites: [],
    },
    linfonodos_masas: {
      canonicalKey: 'linfonodos_masas',
      legacyKeys: [],
      label: 'Masas',
      anchors: ['masas', 'masas abdominales', 'masas cavidad'],
      defaultText: 'ni masas en cavidad abdominal.',
      displayOrder: 3,
      type: 'text',
      dictationRewrites: [],
    },
  },
};

// ── Index: legacy-key → canonical lookup ─────────────────────
//
// Built once at module load. Avoids re-walking the registry on every
// `getCanonicalFieldKey` call.
const LEGACY_INDEX = (() => {
  const idx = {};
  for (const organ of Object.keys(CLINICAL_FIELD_REGISTRY)) {
    idx[organ] = {};
    for (const fieldKey of Object.keys(CLINICAL_FIELD_REGISTRY[organ])) {
      const meta = CLINICAL_FIELD_REGISTRY[organ][fieldKey];
      for (const legacy of meta.legacyKeys) {
        idx[organ][legacy] = meta.canonicalKey;
      }
    }
  }
  return idx;
})();

// ── Public API ───────────────────────────────────────────────

/**
 * Returns the canonical field key for a given (organ, fieldKey).
 * Resolves legacy keys transparently. Idempotent.
 *
 * @param {string} organId
 * @param {string} fieldKey
 * @returns {string} canonical key (or the input if already canonical)
 */
export function getCanonicalFieldKey(organId, fieldKey) {
  if (!fieldKey || typeof fieldKey !== 'string') return fieldKey;
  const organ = CLINICAL_FIELD_REGISTRY[organId];
  if (!organ) return fieldKey;
  if (organ[fieldKey]) return fieldKey;
  return LEGACY_INDEX[organId]?.[fieldKey] ?? fieldKey;
}

/**
 * Inverse: returns the legacy form of a canonical key, if one exists.
 * Used by dictation-aware emit to display the user's spoken term.
 *
 * @param {string} organId
 * @param {string} canonicalKey
 * @returns {string} legacy key or input unchanged
 */
export function legacyFieldKey(organId, canonicalKey) {
  if (!canonicalKey || typeof canonicalKey !== 'string') return canonicalKey;
  const meta = getFieldMeta(organId, canonicalKey);
  if (!meta || !meta.legacyKeys?.length) return canonicalKey;
  return meta.legacyKeys[0];
}

/**
 * Returns full FieldMeta for (organ, fieldKey) — accepts either canonical
 * or legacy form.
 *
 * @returns {FieldMeta|null}
 */
export function getFieldMeta(organId, fieldKey) {
  if (!organId || !fieldKey) return null;
  const organ = CLINICAL_FIELD_REGISTRY[organId];
  if (!organ) return null;
  const canonical = getCanonicalFieldKey(organId, fieldKey);
  return organ[canonical] ?? null;
}

/**
 * Returns the canonical field keys for an organ, ordered by display_order.
 */
export function getCanonicalKeysForOrgan(organId) {
  const organ = CLINICAL_FIELD_REGISTRY[organId];
  if (!organ) return [];
  return Object.keys(organ)
    .map((k) => organ[k])
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((m) => m.canonicalKey);
}

/**
 * Returns the legacy keys for an organ.
 */
export function getLegacyKeysForOrgan(organId) {
  const organ = CLINICAL_FIELD_REGISTRY[organId];
  if (!organ) return [];
  const out = [];
  for (const meta of Object.values(organ)) {
    out.push(...meta.legacyKeys);
  }
  return out;
}

/**
 * Returns the legacy → canonical alias map for an organ.
 * Used by alias-aware validation to count aliases of present tokens
 * as preserved.
 *
 * @returns {Object} { legacyKey: canonicalKey, ... }
 */
export function getAliasMap(organId) {
  return { ...(LEGACY_INDEX[organId] ?? {}) };
}

/**
 * Returns the anchor table for an organ (canonical key → anchors).
 * Backward-compatible with `clinicalFieldAnchors.js`.
 */
export function getAnchorsForOrgan(organId) {
  const organ = CLINICAL_FIELD_REGISTRY[organId];
  if (!organ) return {};
  const out = {};
  for (const meta of Object.values(organ)) {
    out[meta.canonicalKey] = meta.anchors;
  }
  return out;
}

/**
 * Returns the anchor list for a specific (organ, field) pair.
 */
export function getAnchorsForField(organId, fieldKey) {
  const meta = getFieldMeta(organId, fieldKey);
  return meta?.anchors ?? [];
}

/**
 * Returns the dictation rewrites for an organ: organ-specific + global.
 * Each entry is `[RegExp, string | (match) => string]`.
 */
export function getDictationRewrites(organId) {
  const organ = CLINICAL_FIELD_REGISTRY[organId];
  const specific = [];
  if (organ) {
    for (const meta of Object.values(organ)) {
      specific.push(...meta.dictationRewrites);
    }
  }
  return [...specific, ...GLOBAL_DICTATION_REWRITES];
}

/**
 * Returns the megalia expansion for an organ, or null.
 */
export function getMegaliaExpansion(organId) {
  if (!organId) return null;
  const key = organId.toLowerCase();
  return MEGALIA_EXPANSIONS[key] ?? null;
}

/**
 * Returns the defaults for an organ in the engine format:
 *   { canonicalKey: { display_order, default_text, description }, ... }
 *
 * `description` is the anatomical scope carried in the Registry
 * (falls back to `label` when not present). The classification
 * service forwards this to the JSON Schema sent to the LLM so the
 * model receives disambiguating guidance for concepts with
 * overlapping anatomical scope (e.g., Hígado ecogenicidad vs
 * patrón vascular). Callers that do not need it can ignore the
 * field — the shape is backward-compatible.
 */
export function getDefaultsForOrgan(organId) {
  const organ = CLINICAL_FIELD_REGISTRY[organId];
  if (!organ) return {};
  const out = {};
  for (const meta of Object.values(organ)) {
    out[meta.canonicalKey] = {
      display_order: meta.displayOrder,
      default_text: meta.defaultText,
      description: meta.description ?? meta.label ?? meta.canonicalKey,
    };
  }
  return out;
}

/**
 * Returns the human-readable label for a field.
 */
export function getFieldLabel(organId, fieldKey) {
  const meta = getFieldMeta(organId, fieldKey);
  return meta?.label ?? null;
}

/**
 * Returns the numeric display order for a field.
 */
export function getDisplayOrder(organId, fieldKey) {
  const meta = getFieldMeta(organId, fieldKey);
  return meta?.displayOrder ?? null;
}

/**
 * Returns the display label for an organ id.
 */
export function getOrganLabel(organId) {
  return ORGAN_LABELS[organId] ?? organId ?? '';
}

/**
 * Returns all organ display labels.
 */
export function getAllOrganLabels() {
  return Object.values(ORGAN_LABELS);
}

/**
 * Returns the organ label map.
 */
export function getOrganLabelMap() {
  return { ...ORGAN_LABELS };
}

// ── Organ metadata (Phase 7) helpers ─────────────────────────
//
// These functions expose ORGAN_META to consumers (DOCX, renderEngine,
// App.jsx, buildClinicalDocument). They are intentionally simple
// data accessors — no business logic lives in the Registry.

/**
 * Returns the full OrganMeta entry for an organId, or null.
 */
export function getOrganMeta(organId) {
  if (!organId || !ORGAN_META[organId]) return null;
  return { organId, ...ORGAN_META[organId] };
}

/**
 * Returns the numeric display order for an organ, or null.
 */
export function getOrganDisplayOrder(organId) {
  return ORGAN_META[organId]?.organDisplayOrder ?? null;
}

/**
 * Returns the visibility-rule name for an organ, or null.
 * Resolution of the rule against patient data lives in
 * `clinicalVisibilityRules.js`.
 */
export function getVisibilityRule(organId) {
  return ORGAN_META[organId]?.visibilityRule ?? null;
}

/**
 * Returns the variant-resolver name for an organ, or null.
 * Resolution of sub-sections lives in `clinicalVisibilityRules.js`.
 */
export function getVariantResolver(organId) {
  return ORGAN_META[organId]?.variants ?? null;
}

/**
 * Returns the paragraph-split fraction for an organ, or null.
 * 0.5 means "split fields array at the midpoint into two paragraphs".
 */
export function getParagraphSplit(organId) {
  return ORGAN_META[organId]?.paragraphSplit ?? null;
}

/**
 * Returns the canonical ordered list of display organs.
 * Each entry has shape { organId, organDisplayOrder, visibilityRule,
 * paragraphSplit, variants }. Excludes variant children.
 */
export function getDisplayOrgans() {
  return Object.entries(ORGAN_META)
    .map(([organId, meta]) => ({ organId, ...meta }))
    .sort((a, b) => a.organDisplayOrder - b.organDisplayOrder);
}

/**
 * Lists the organIds registered in ORGAN_META (top-level display organs).
 */
export function getDisplayOrganIds() {
  return Object.keys(ORGAN_META);
}

/**
 * Alias-aware token check used by validation: returns true if `token`
 * is itself in `presentTokens` OR if any alias of `token` is in
 * `presentTokens`. This makes `arquitectura` (alias of `parenquima`)
 * count as preserved when its canonical `parenquima` is in the
 * narrative.
 *
 * `token` may be either:
 *   - the bare suffix (e.g. `arquitectura`, `parenquima`)
 *   - the full prefixed key (e.g. `bazo_arquitectura`)
 *
 * @param {string} token
 * @param {Set<string>} presentTokens
 * @param {string} organId
 * @returns {boolean}
 */
export function isAliasOfPresent(token, presentTokens, organId) {
  if (!token || !presentTokens) return false;
  if (presentTokens.has(token)) return true;
  const aliasMap = getAliasMap(organId);
  if (!aliasMap) return false;

  for (const [legacyKey, canonicalKey] of Object.entries(aliasMap)) {
    // Full-key match
    if (legacyKey === token && presentTokens.has(canonicalKey)) return true;
    if (canonicalKey === token && presentTokens.has(legacyKey)) return true;
    // Suffix match — handles bare tokens like `arquitectura`
    // (alias of `bazo_arquitectura`).
    const legacySuffix = legacyKey.includes('_')
      ? legacyKey.slice(legacyKey.lastIndexOf('_') + 1)
      : legacyKey;
    const canonicalSuffix = canonicalKey.includes('_')
      ? canonicalKey.slice(canonicalKey.lastIndexOf('_') + 1)
      : canonicalKey;
    if (legacySuffix === token && presentTokens.has(canonicalSuffix)) return true;
    if (canonicalSuffix === token && presentTokens.has(legacySuffix)) return true;
  }
  return false;
}

/**
 * Returns true if the given (organ, fieldKey) pair has any legacy alias.
 */
export function isRenameCandidate(organId, fieldKey) {
  const meta = getFieldMeta(organId, fieldKey);
  return Boolean(meta?.legacyKeys?.length);
}

/**
 * Resolves a field key against an optional organ hint, falling back
 * to every registered organ if the hint doesn't recognize the key.
 * Used by `renameFieldKeysDeep` to handle multi-organ classification
 * objects where the caller can't pre-pass a single organId.
 */
function resolveFieldKey(fieldKey, hintOrganId) {
  if (!fieldKey || typeof fieldKey !== 'string') return fieldKey;
  if (hintOrganId && (CLINICAL_FIELD_REGISTRY[hintOrganId]?.[fieldKey] || LEGACY_INDEX[hintOrganId]?.[fieldKey])) {
    return getCanonicalFieldKey(hintOrganId, fieldKey);
  }
  for (const organId of Object.keys(CLINICAL_FIELD_REGISTRY)) {
    if (CLINICAL_FIELD_REGISTRY[organId][fieldKey] || LEGACY_INDEX[organId]?.[fieldKey]) {
      return getCanonicalFieldKey(organId, fieldKey);
    }
  }
  return fieldKey;
}

/**
 * Recursively applies getCanonicalFieldKey to every key of an object.
 * Used to normalize LLM output that may still emit legacy keys. When
 * `organId` is given, it's used as a hint; otherwise (or for keys the
 * hint doesn't recognize), the function scans every registered organ.
 *
 * @param {*} obj
 * @param {string} [organId]
 */
export function renameFieldKeysDeep(obj, organId) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((o) => renameFieldKeysDeep(o, organId));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[resolveFieldKey(k, organId)] = renameFieldKeysDeep(v, organId);
  }
  return out;
}

/**
 * Applies the organ's dictation rewrites (organ-specific + global) to
 * a piece of text. Used to render the user's spoken term → canonical
 * term inside free-text segments.
 *
 * @param {string} text
 * @param {string} organId
 * @returns {string}
 */
export function renameTermInText(text, organId) {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  const rewrites = getDictationRewrites(organId);
  for (const [pattern, replacement] of rewrites) {
    if (typeof replacement === 'function') {
      result = result.replace(pattern, replacement);
    } else {
      result = result.replace(pattern, replacement);
    }
  }
  return result;
}

/**
 * Returns true if the canonical key is in the registry.
 */
export function hasField(organId, fieldKey) {
  return Boolean(getFieldMeta(organId, fieldKey));
}

/**
 * Returns the list of organ ids registered.
 */
export function getRegisteredOrganIds() {
  return Object.keys(CLINICAL_FIELD_REGISTRY);
}

/**
 * Helper for tests / dev tooling: full registry snapshot.
 */
export function getRegistrySnapshot() {
  return JSON.parse(JSON.stringify(CLINICAL_FIELD_REGISTRY));
}

// ── Variant children (single source of truth) ────────────────
//
// Maps each top-level display organ that has variant children to its
// ordered list of children. Children appear in the order they should
// be rendered (left/right convention: izquierdo before derecho).
//
// Used by:
//   - getVariantChildIds (this module)
//   - KIDNEY_SUB_SECTIONS / ADRENAL_SUB_SECTIONS (this module)
//   - clinicalDocumentModel.getVariantChildIds (re-export for compat)
//   - clinicalAppOrchestrator (legacy re-exports)
const VARIANT_CHILDREN = {
  rinones: ['rinon_izquierdo', 'rinon_derecho'],
  adrenales: ['adrenal_izquierda', 'adrenal_derecha'],
};

/**
 * Returns the variant child organIds for a given display organ id.
 * Returns [] for standalone organs.
 */
export function getVariantChildIds(displayOrganId) {
  return VARIANT_CHILDREN[displayOrganId] ?? [];
}

/**
 * Kidney sub-sections. Derived from the registry — labels come from
 * ORGAN_LABELS, fields come from getCanonicalKeysForOrgan (which is
 * sorted by displayOrder). This is the canonical source.
 */
export const KIDNEY_SUB_SECTIONS = getVariantChildIds('rinones').map((id) => ({
  id,
  label: ORGAN_LABELS[id] ?? id,
  fields: getCanonicalKeysForOrgan(id),
}));

/**
 * Adrenal sub-sections. Same derivation pattern as KIDNEY_SUB_SECTIONS.
 */
export const ADRENAL_SUB_SECTIONS = getVariantChildIds('adrenales').map((id) => ({
  id,
  label: ORGAN_LABELS[id] ?? id,
  fields: getCanonicalKeysForOrgan(id),
}));
