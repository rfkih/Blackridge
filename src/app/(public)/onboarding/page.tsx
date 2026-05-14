'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronLeft, Shield, Zap, Globe, Check } from 'lucide-react';
import { BlackridgeMark } from '@/components/brand/BlackridgeMark';

type ExperienceValue = '' | 'new' | 'some' | 'pro';
type CapitalValue = '' | 'paper' | '5k' | '50k' | '500k';
type ExchangeValue = 'binance' | 'bybit' | 'okx';

interface OnboardingState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  country: string;
  experience: ExperienceValue;
  capital: CapitalValue;
  strategies: string[];
  exchange: ExchangeValue;
  apiKey: string;
  apiSecret: string;
}

const INITIAL: OnboardingState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  country: 'Singapore',
  experience: '',
  capital: '',
  strategies: [],
  exchange: 'binance',
  apiKey: '',
  apiSecret: '',
};

const TOTAL_STEPS = 5;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingState>(INITIAL);

  const set = <K extends keyof OnboardingState>(k: K, v: OnboardingState[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const toggleStrategy = (id: string) =>
    setData((d) => ({
      ...d,
      strategies: d.strategies.includes(id)
        ? d.strategies.filter((s) => s !== id)
        : [...d.strategies, id],
    }));

  const stepValid = () => {
    if (step === 0) return data.email.includes('@') && data.password.length >= 8;
    if (step === 1) return data.firstName.length > 0 && data.lastName.length > 0;
    if (step === 2) return data.experience !== '' && data.capital !== '';
    if (step === 3) return data.strategies.length > 0;
    return true;
  };

  const next = () => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="br grid min-h-screen grid-cols-2">
      {/* Left art panel */}
      <aside
        className="relative flex flex-col justify-between overflow-hidden p-14"
        style={{
          background: 'linear-gradient(160deg, var(--brand-700), var(--brand-900))',
          color: '#fff',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: -140,
            bottom: -140,
            width: 460,
            height: 460,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <Link
          href="/welcome"
          className="relative z-[1] inline-flex w-fit items-center gap-2.5"
          style={{ color: '#fff' }}
        >
          <BlackridgeMark size={36} tone="inverse" />
          <span
            className="font-display"
            style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}
          >
            <span style={{ color: '#fff' }}>Black</span>
            <span style={{ color: '#16B364' }}>ridge</span>
          </span>
        </Link>

        <div className="relative z-[1]">
          <div
            className="font-display"
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
              maxWidth: 380,
            }}
          >
            “I sleep through Asia open now. Last quarter the bot beat my discretionary book by 14%.”
          </div>
          <div className="mt-7 flex items-center gap-3">
            <div
              className="grid place-items-center"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.16)',
                fontWeight: 700,
              }}
            >
              MC
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>Maya Chen</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                Prop trader · Hong Kong
              </div>
            </div>
          </div>
        </div>

        <div
          className="relative z-[1] flex gap-7 text-[13px]"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Shield size={16} /> SOC 2 in progress
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Zap size={16} /> 42ms order latency
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Globe size={16} /> 24/7 on-call
          </span>
        </div>
      </aside>

      {/* Right form */}
      <main className="w-full p-14" style={{ background: 'var(--bg-base)' }}>
        <div className="mx-auto w-full" style={{ maxWidth: 560 }}>
          <div className="mb-4 flex items-center justify-between">
            <Link href="/welcome" className="br-btn br-btn-ghost br-btn-sm">
              <ChevronLeft size={14} /> Back to site
            </Link>
            <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Step {step + 1} of {TOTAL_STEPS}
            </div>
          </div>

          <div className="mb-9 flex gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-colors"
                style={{
                  background: i <= step ? 'var(--brand-500)' : 'var(--border-default)',
                }}
              />
            ))}
          </div>

          {step === 0 && (
            <Step
              title="Open your Blackridge account"
              sub="Three minutes. Paper trading is free for 14 days — no card required."
            >
              <button
                type="button"
                className="br-btn br-btn-secondary br-btn-block br-btn-lg"
                style={{ gap: 10 }}
              >
                Continue with Google
              </button>
              <button
                type="button"
                className="br-btn br-btn-secondary br-btn-block br-btn-lg mt-2.5"
                style={{ gap: 10 }}
              >
                Continue with Apple
              </button>
              <Divider>or</Divider>
              <Field label="Work email">
                <input
                  className="br-input"
                  type="email"
                  placeholder="you@firm.com"
                  value={data.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </Field>
              <Field label="Password">
                <input
                  className="br-input"
                  type="password"
                  placeholder="At least 8 characters"
                  value={data.password}
                  onChange={(e) => set('password', e.target.value)}
                />
              </Field>
              <label
                htmlFor="onboarding-tos"
                className="mt-3 flex items-start gap-2.5 text-[13px]"
                style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}
              >
                <input id="onboarding-tos" type="checkbox" defaultChecked className="mt-0.5" />
                <span>
                  I agree to the Terms of Service and Privacy Policy, and confirm I&apos;m 18 or
                  older.
                </span>
              </label>
            </Step>
          )}

          {step === 1 && (
            <Step
              title="Tell us who's trading"
              sub="We need this for tax reporting and to fit you into the right risk bucket."
            >
              <Row>
                <Field label="First name">
                  <input
                    className="br-input"
                    value={data.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                  />
                </Field>
                <Field label="Last name">
                  <input
                    className="br-input"
                    value={data.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                  />
                </Field>
              </Row>
              <Field label="Country of residence">
                <select
                  className="br-input"
                  value={data.country}
                  onChange={(e) => set('country', e.target.value)}
                >
                  <option>Singapore</option>
                  <option>United States</option>
                  <option>Hong Kong</option>
                  <option>United Kingdom</option>
                  <option>Indonesia</option>
                  <option>Japan</option>
                  <option>Australia</option>
                </select>
              </Field>
              <Field label="Date of birth">
                <input className="br-input" type="date" defaultValue="1990-06-12" />
              </Field>
              <div
                className="mt-2 flex gap-2.5 rounded-xl p-3.5 text-[13px]"
                style={{ background: 'var(--tint-info)', color: 'var(--color-info)' }}
              >
                <Shield size={18} className="mt-0.5 flex-shrink-0" />
                <div style={{ color: 'var(--text-secondary)' }}>
                  KYC happens later, after you&apos;ve used the platform. You can paper-trade today.
                </div>
              </div>
            </Step>
          )}

          {step === 2 && (
            <Step
              title="How do you trade today?"
              sub="So we can suggest sensible defaults — you can always change them later."
            >
              <Field label="Trading experience">
                <RadioGroup
                  value={data.experience}
                  onChange={(v) => set('experience', v as ExperienceValue)}
                  options={[
                    {
                      value: 'new',
                      label: 'New to algorithmic trading',
                      sub: "I've traded manually but never run a bot.",
                    },
                    {
                      value: 'some',
                      label: "I've run bots before",
                      sub: 'Comfortable with parameters and backtests.',
                    },
                    {
                      value: 'pro',
                      label: 'Professional / prop',
                      sub: 'I manage a book or run for a desk.',
                    },
                  ]}
                />
              </Field>
              <Field label="Capital you plan to deploy">
                <RadioGroup
                  value={data.capital}
                  onChange={(v) => set('capital', v as CapitalValue)}
                  options={[
                    { value: 'paper', label: 'Paper trading first', sub: 'Free for 14 days.' },
                    { value: '5k', label: '$1k – $25k' },
                    { value: '50k', label: '$25k – $250k' },
                    { value: '500k', label: '$250k+' },
                  ]}
                />
              </Field>
            </Step>
          )}

          {step === 3 && (
            <Step
              title="Pick a starting strategy or two"
              sub="You can always enable more later. Most traders start with one and watch it for a week."
            >
              {[
                {
                  id: 'LSR-V2',
                  name: 'Long-Short Reversal v2',
                  tag: 'Top performer',
                  pnl: '+12.5%',
                  sharpe: '1.84',
                },
                {
                  id: 'VCB',
                  name: 'Volatility Compression',
                  tag: 'Most popular',
                  pnl: '+6.7%',
                  sharpe: '1.42',
                },
                {
                  id: 'TPSE',
                  name: 'Trend Pullback Single-Exit',
                  tag: 'Best Sharpe',
                  pnl: '+4.9%',
                  sharpe: '2.04',
                },
                {
                  id: 'VBO',
                  name: 'Volume Breakout',
                  tag: 'Volatile',
                  pnl: '+2.8%',
                  sharpe: '0.92',
                },
              ].map((s) => {
                const on = data.strategies.includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleStrategy(s.id)}
                    className="mb-2.5 flex w-full items-center gap-3.5 rounded-2xl p-4 text-left transition-colors"
                    style={{
                      border: `1.5px solid ${on ? 'var(--brand-500)' : 'var(--border-default)'}`,
                      background: on ? 'var(--brand-50)' : 'var(--bg-elevated)',
                    }}
                  >
                    <div
                      className="grid flex-shrink-0 place-items-center"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 7,
                        border: `1.5px solid ${on ? 'var(--brand-500)' : 'var(--border-default)'}`,
                        background: on ? 'var(--brand-500)' : 'transparent',
                        color: '#fff',
                      }}
                    >
                      {on && <Check size={14} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-[15px] font-semibold">{s.name}</div>
                        <span className="br-chip br-chip-brand text-[10px]">{s.tag}</span>
                      </div>
                      <div className="mt-0.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        30d return{' '}
                        <span style={{ color: 'var(--color-profit)', fontWeight: 600 }}>
                          {s.pnl}
                        </span>{' '}
                        · Sharpe <strong>{s.sharpe}</strong>
                      </div>
                    </div>
                  </button>
                );
              })}
            </Step>
          )}

          {step === 4 && (
            <Step
              title="Connect an exchange (optional)"
              sub="Or skip to paper-trade. You can connect any time from settings."
            >
              <div className="mb-4 grid grid-cols-3 gap-2.5">
                {(['binance', 'bybit', 'okx'] as ExchangeValue[]).map((ex) => (
                  <button
                    type="button"
                    key={ex}
                    onClick={() => set('exchange', ex)}
                    className="rounded-xl text-[14px] font-semibold capitalize transition-colors"
                    style={{
                      padding: '14px 12px',
                      border: `1.5px solid ${data.exchange === ex ? 'var(--brand-500)' : 'var(--border-default)'}`,
                      background: data.exchange === ex ? 'var(--brand-50)' : 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <Field label="API key">
                <input
                  className="br-input"
                  placeholder="Paste your read-and-trade API key"
                  value={data.apiKey}
                  onChange={(e) => set('apiKey', e.target.value)}
                />
              </Field>
              <Field label="API secret">
                <input
                  className="br-input"
                  type="password"
                  placeholder="Stored encrypted on our servers"
                  value={data.apiSecret}
                  onChange={(e) => set('apiSecret', e.target.value)}
                />
              </Field>
              <div
                className="mt-2 flex gap-2.5 rounded-xl p-3.5 text-[13px]"
                style={{ background: 'var(--tint-warning)' }}
              >
                <Shield
                  size={18}
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: 'var(--color-warning)' }}
                />
                <div style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Make sure withdrawals are disabled
                  </strong>{' '}
                  on this API key. Blackridge will never need to withdraw your funds.
                </div>
              </div>
              <button
                type="button"
                className="br-btn br-btn-ghost br-btn-block mt-3.5"
                onClick={() => {
                  set('apiKey', '');
                  set('apiSecret', '');
                }}
              >
                Skip — start with paper trading
              </button>
            </Step>
          )}

          {/* Footer actions */}
          <div
            className="mt-9 flex items-center justify-between pt-6"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            {step > 0 ? (
              <button type="button" className="br-btn br-btn-secondary" onClick={back}>
                <ChevronLeft size={14} /> Back
              </button>
            ) : (
              <span />
            )}
            {step < TOTAL_STEPS - 1 ? (
              <button
                type="button"
                className="br-btn br-btn-primary br-btn-lg"
                disabled={!stepValid()}
                onClick={next}
              >
                Continue <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="br-btn br-btn-primary br-btn-lg"
                onClick={() => router.push('/login')}
              >
                Open my dashboard <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Step({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h1
        className="font-display"
        style={{
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          margin: '0 0 8px',
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 15,
          color: 'var(--text-secondary)',
          margin: '0 0 28px',
        }}
      >
        {sub}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // The label wraps its child input — implicit association per HTML spec.
  // jsx-a11y's strict default still flags this since it can't statically
  // see the input through arbitrary children; the wrapping pattern is valid.
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className="mb-3.5 block">
      <span className="br-label">{label}</span>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="mb-3.5 grid grid-cols-2 gap-3">{children}</div>;
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="my-5 flex items-center gap-3 text-[12px]"
      style={{ color: 'var(--text-muted)' }}
    >
      <span className="h-px flex-1" style={{ background: 'var(--border-default)' }} />
      <span>{children}</span>
      <span className="h-px flex-1" style={{ background: 'var(--border-default)' }} />
    </div>
  );
}

interface RadioOption {
  value: string;
  label: string;
  sub?: string;
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: RadioOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            type="button"
            key={o.value}
            onClick={() => onChange(o.value)}
            className="flex items-start gap-3 rounded-xl p-3.5 text-left transition-colors"
            style={{
              border: `1.5px solid ${on ? 'var(--brand-500)' : 'var(--border-default)'}`,
              background: on ? 'var(--brand-50)' : 'var(--bg-elevated)',
            }}
          >
            <div
              className="mt-0.5 grid flex-shrink-0 place-items-center rounded-full"
              style={{
                width: 20,
                height: 20,
                border: `2px solid ${on ? 'var(--brand-500)' : 'var(--border-default)'}`,
              }}
            >
              {on && (
                <div
                  className="rounded-full"
                  style={{ width: 10, height: 10, background: 'var(--brand-500)' }}
                />
              )}
            </div>
            <div>
              <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {o.label}
              </div>
              {o.sub && (
                <div className="mt-0.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  {o.sub}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
