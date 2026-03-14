import { useState } from 'react';
import NerveLogo from '@/components/NerveLogo';

function NerveLogoPreviewPage() {
  const [size, setSize] = useState(150);

  return (
    <main className="min-h-screen bg-[#0d1117] px-6 py-10 text-[#f5ede3]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#ffb169]">
            Preview
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Nerve Logo Scale Test</h1>
          <p className="max-w-2xl text-sm text-[#d3c2ae]">
            Adjust the logo size from 50px to 250px. The node radius and the overall
            component radius stay proportional while the animation timing remains unchanged.
          </p>
        </div>

        <section className="rounded-3xl border border-[#ff8c3230] bg-[#171c24]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex w-full max-w-xl flex-col gap-3">
              <span className="text-xs font-medium uppercase tracking-[0.24em] text-[#d3c2ae]">
                Size: {size}px
              </span>
              <input
                type="range"
                min={50}
                max={250}
                step={1}
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
                className="w-full accent-[#ff8c32]"
                aria-label="Adjust Nerve logo size"
              />
              <div className="flex justify-between text-xs text-[#9b8c79]">
                <span>50px</span>
                <span>250px</span>
              </div>
            </label>

            <div className="rounded-3xl border border-[#ff8c3226] bg-[radial-gradient(circle_at_center,_rgba(255,140,50,0.2),_rgba(13,17,23,0)_60%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-8">
              <div
                className="grid place-items-center rounded-[28px] border border-[#ffffff10] bg-[#0d1117]/80"
                style={{ width: 320, height: 320 }}
              >
                <NerveLogo size={size} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function NerveLogoPreview() {
  return <NerveLogoPreviewPage />;
}

export function VowelLogoPreview() {
  return <NerveLogoPreviewPage />;
}
