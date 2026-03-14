import { useState, type ComponentType } from 'react';
import NerveLogo from '@/components/NerveLogo';
import VowelLogo from '@/components/VowelLogo';

function LogoPreviewPage({
  title,
  description,
  accent,
  panelBorder,
  panelBackground,
  chromeText,
  minorText,
  sliderLabel,
  sliderAccent,
  LogoComponent,
}: {
  title: string;
  description: string;
  accent: string;
  panelBorder: string;
  panelBackground: string;
  chromeText: string;
  minorText: string;
  sliderLabel: string;
  sliderAccent: string;
  LogoComponent: ComponentType<{ size: number }>;
}) {
  const [size, setSize] = useState(150);
  return (
    <main className="min-h-screen bg-[#0d1117] px-6 py-10 text-[#f5ede3]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.32em]" style={{ color: accent }}>
            Preview
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-2xl text-sm" style={{ color: chromeText }}>
            {description}
          </p>
        </div>

        <section
          className="rounded-3xl border p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur"
          style={{ borderColor: panelBorder, background: panelBackground }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex w-full max-w-xl flex-col gap-3">
              <span className="text-xs font-medium uppercase tracking-[0.24em]" style={{ color: chromeText }}>
                Size: {size}px
              </span>
              <input
                type="range"
                min={50}
                max={250}
                step={1}
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
                className="w-full"
                style={{ accentColor: sliderAccent }}
                aria-label={sliderLabel}
              />
              <div className="flex justify-between text-xs" style={{ color: minorText }}>
                <span>50px</span>
                <span>250px</span>
              </div>
            </label>

            <div className="rounded-3xl border p-8" style={{ borderColor: panelBorder, background: panelBackground }}>
              <div
                className="grid place-items-center rounded-[28px] border border-[#ffffff10] bg-[#0d1117]/80"
                style={{ width: 320, height: 320 }}
              >
                <LogoComponent size={size} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function NerveLogoPreview() {
  return (
    <LogoPreviewPage
      title="vowel | Nerve Logo Scale Test"
      description="Adjust the logo size from 50px to 250px. The node radius and the overall component radius stay proportional while the animation timing remains unchanged."
      accent="#ffb169"
      panelBorder="#ff8c3230"
      panelBackground="rgba(23,28,36,0.9)"
      chromeText="#d3c2ae"
      minorText="#9b8c79"
      sliderLabel="Adjust vowel | Nerve logo size"
      sliderAccent="#ff8c32"
      LogoComponent={NerveLogo}
    />
  );
}

export function VowelLogoPreview() {
  const [size, setSize] = useState(150);
  const [mode, setMode] = useState<'logo' | 'word'>('logo');
  const [reducedMotion, setReducedMotion] = useState(false);

  return (
    <main className="min-h-screen bg-[#0d1117] px-6 py-10 text-[#f5ede3]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.32em]" style={{ color: '#8cc3ff' }}>
            Preview
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Vowel Logo Scale Test</h1>
          <p className="max-w-2xl text-sm text-[#c7defb]">
            Switch between the full logo and the OCR-A word mark, and toggle reduced motion to inspect the static states.
          </p>
        </div>

        <section
          className="rounded-3xl border p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur"
          style={{ borderColor: '#5aa2ff30', background: 'linear-gradient(180deg, rgba(15,24,38,0.94), rgba(10,16,29,0.92))' }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full max-w-xl flex-col gap-5">
              <label className="flex flex-col gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.24em] text-[#c7defb]">
                  Size: {size}px
                </span>
                <input
                  type="range"
                  min={50}
                  max={250}
                  step={1}
                  value={size}
                  onChange={(event) => setSize(Number(event.target.value))}
                  className="w-full"
                  style={{ accentColor: '#5aa2ff' }}
                  aria-label="Adjust Vowel logo size"
                />
                <div className="flex justify-between text-xs text-[#7f98b8]">
                  <span>50px</span>
                  <span>250px</span>
                </div>
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setMode('logo')}
                  className="rounded-full border px-4 py-2 text-sm"
                  style={{
                    borderColor: mode === 'logo' ? '#5aa2ff' : '#5aa2ff40',
                    background: mode === 'logo' ? '#5aa2ff20' : 'transparent',
                    color: '#c7defb',
                  }}
                >
                  isLogo
                </button>
                <button
                  type="button"
                  onClick={() => setMode('word')}
                  className="rounded-full border px-4 py-2 text-sm"
                  style={{
                    borderColor: mode === 'word' ? '#5aa2ff' : '#5aa2ff40',
                    background: mode === 'word' ? '#5aa2ff20' : 'transparent',
                    color: '#c7defb',
                  }}
                >
                  isWord
                </button>
                <label className="flex items-center gap-2 rounded-full border border-[#5aa2ff40] px-4 py-2 text-sm text-[#c7defb]">
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(event) => setReducedMotion(event.target.checked)}
                    className="accent-[#5aa2ff]"
                  />
                  Reduced Motion
                </label>
              </div>
            </div>

            <div className="rounded-3xl border p-8" style={{ borderColor: '#5aa2ff30', background: 'linear-gradient(180deg, rgba(15,24,38,0.94), rgba(10,16,29,0.92))' }}>
              <div
                className="grid place-items-center rounded-[28px] border border-[#ffffff10] bg-[#0d1117]/80"
                style={{ width: 320, height: 320 }}
              >
                <VowelLogo
                  size={size}
                  isLogo={mode === 'logo'}
                  isWord={mode === 'word'}
                  reducedMotion={reducedMotion}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
