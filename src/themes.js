// Per-theme settings that live outside CSS: code highlighting, Mermaid,
// and the colors painted into the PDF header/footer margin areas.

// Mermaid 'base' theme variables derived from a theme's palette, so diagrams
// match the document colors instead of Mermaid's stock themes.
function mermaidVars({ dark, bg, fg, line, node, nodeBorder, alt, alt2, note, series, font }) {
  const pies = Object.fromEntries(series.map((c, i) => [`pie${i + 1}`, c]));
  const scales = Object.fromEntries(
    series.flatMap((c, i) => [[`cScale${i}`, c], [`cScaleLabel${i}`, '#ffffff']]),
  );
  return {
    darkMode: dark,
    background: bg,
    fontFamily: font,
    fontSize: '15px',
    textColor: fg,
    lineColor: line,
    primaryColor: node,
    primaryTextColor: fg,
    primaryBorderColor: nodeBorder,
    secondaryColor: alt,
    secondaryTextColor: fg,
    secondaryBorderColor: nodeBorder,
    tertiaryColor: alt2,
    tertiaryTextColor: fg,
    tertiaryBorderColor: nodeBorder,
    mainBkg: node,
    nodeBorder,
    clusterBkg: alt2,
    clusterBorder: nodeBorder,
    edgeLabelBackground: bg,
    noteBkgColor: note,
    noteTextColor: fg,
    noteBorderColor: nodeBorder,
    actorBkg: node,
    actorBorder: nodeBorder,
    actorTextColor: fg,
    actorLineColor: line,
    signalColor: fg,
    signalTextColor: fg,
    labelBoxBkgColor: node,
    labelTextColor: fg,
    sequenceNumberColor: bg,
    pieStrokeColor: bg,
    pieOuterStrokeColor: line,
    pieTitleTextColor: fg,
    pieSectionTextColor: '#ffffff',
    pieLegendTextColor: fg,
    taskBkgColor: series[0],
    taskBorderColor: nodeBorder,
    taskTextColor: '#ffffff',
    taskTextDarkColor: fg,
    activeTaskBkgColor: series[2],
    activeTaskBorderColor: nodeBorder,
    doneTaskBkgColor: series[3],
    doneTaskBorderColor: nodeBorder,
    critBkgColor: series[1],
    sectionBkgColor: alt2,
    sectionBkgColor2: bg,
    altSectionBkgColor: bg,
    gridColor: line,
    todayLineColor: series[1],
    ...pies,
    ...scales,
  };
}

const SANS = "'Inter', -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

export const THEMES = {
  light: {
    shiki: 'github-light',
    bg: '#ffffff',
    accent: '#4f46e5',
    muted: '#6b7280',
    mermaid: mermaidVars({
      dark: false,
      bg: '#ffffff',
      fg: '#1f2328',
      line: '#64748b',
      node: '#e0e7ff',
      nodeBorder: '#6366f1',
      alt: '#ccfbf1',
      alt2: '#f5f3ff',
      note: '#fef3c7',
      series: ['#6366f1', '#ec4899', '#14b8a6', '#22c55e', '#f59e0b', '#8b5cf6', '#0ea5e9', '#ef4444', '#84cc16', '#f97316', '#06b6d4', '#a855f7'],
      font: SANS,
    }),
  },
  dark: {
    shiki: 'github-dark',
    bg: '#0f1419',
    accent: '#a5b4fc',
    muted: '#8b949e',
    mermaid: mermaidVars({
      dark: true,
      bg: '#0f1419',
      fg: '#e6edf3',
      line: '#8b949e',
      node: '#1e2a4a',
      nodeBorder: '#7c8cff',
      alt: '#123a3a',
      alt2: '#171d2b',
      note: '#3b2f12',
      series: ['#6366f1', '#db2777', '#0d9488', '#16a34a', '#d97706', '#7c3aed', '#0284c7', '#dc2626', '#65a30d', '#ea580c', '#0891b2', '#9333ea'],
      font: SANS,
    }),
  },
  sepia: {
    shiki: 'solarized-light',
    bg: '#f6efe0',
    accent: '#9a3412',
    muted: '#8a7a5c',
    mermaid: mermaidVars({
      dark: false,
      bg: '#f6efe0',
      fg: '#3b3024',
      line: '#8a7a5c',
      node: '#f3dfc1',
      nodeBorder: '#b45309',
      alt: '#dcebdc',
      alt2: '#efe5cf',
      note: '#f5d58a',
      series: ['#b45309', '#9f1239', '#0f766e', '#4d7c0f', '#a16207', '#6b21a8', '#1d4ed8', '#b91c1c', '#65a30d', '#c2410c', '#0e7490', '#7e22ce'],
      font: "'Charter', Georgia, serif",
    }),
  },
};

export const THEME_NAMES = Object.keys(THEMES);

export function getTheme(name) {
  const theme = THEMES[name];
  if (!theme) {
    throw new Error(`Unknown theme "${name}". Available: ${THEME_NAMES.join(', ')}`);
  }
  return theme;
}
