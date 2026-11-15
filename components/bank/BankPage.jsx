'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import s from './bank.module.css';
import { UNIT, useGameCalendar, useClubBudget } from '@/lib/bankAdapter';
import {
  getBankStatus, getLoans, getHistory, getPenalties, processPenalties,
  quoteLoan, requestLoan, repayLoan, quoteReschedule, rescheduleLoan,
  syncBankCash, newKey,
} from '@/lib/bankApi';

/* ----------------------------------------------------------- helpers */
const M = (n) =>
  `${(Number(n || 0) / UNIT).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`;

const outstanding = (l) =>
  Number(l.principal) + Number(l.interest_amount) + Number(l.fines_amount) +
  Number(l.reschedule_fees) - Number(l.paid_amount);

const STAGE_TEXT = ['', 'غرامة 5%', 'غرامة 10%', 'تجميد الانتقالات', 'أزمة مالية', 'خصم نقاط'];
const TX_TEXT = { disburse: 'صرف قرض', repay: 'سداد', reschedule_fee: 'رسوم إعادة جدولة' };
const PEN_TEXT = {
  late_fine_1: 'غرامة التأخير الأولى',
  late_fine_2: 'غرامة التأخير الثانية',
  transfer_freeze: 'تجميد ميزانية الانتقالات',
  financial_crisis: 'إعلان أزمة مالية',
  points_deduction: 'خصم نقاط من الدوري',
};
const NOTICE_TEXT = {
  1: 'تحذير رسمي من البنك: فات موعد سداد القرض، وتم تطبيق غرامة 5%.',
  2: 'تأخر السداد أكثر من 7 أيام: غرامة 10%، منع القروض الجديدة، وخفض التصنيف الائتماني.',
  3: 'تأخر السداد أكثر من 15 يوم: تم تجميد جزء من ميزانية الانتقالات ومنع التعاقد مع لاعبين.',
  4: 'النادي في أزمة مالية بعد 30 يوم تأخير. ممكن البنك يطلب بيع لاعب لتغطية الدين.',
  5: 'تم خصم نقاط من الدوري بسبب التعثر الشديد.',
};
const ERRORS = {
  LOANS_BLOCKED: 'القروض الجديدة ممنوعة بسبب التأخر في السداد.',
  AMOUNT_OUT_OF_RANGE: 'المبلغ لازم يكون بين 10 و300 مليون.',
  LIMIT_BY_CREDIT: 'تصنيفك الائتماني الحالي يسمح بقرض حتى 50 مليون فقط.',
  LOAN_NOT_FOUND: 'القرض غير موجود أو تم سداده.',
  BAD_AMOUNT: 'مبلغ السداد غير صحيح.',
  RESCHEDULE_NOT_ALLOWED: 'إعادة الجدولة غير متاحة بعد دخول مرحلة التأخير الثانية.',
  BAD_EXTENSION: 'مدة التمديد غير مسموحة.',
  NOT_AUTHENTICATED: 'سجّل الدخول أولاً.',
  BAD_CALENDAR: 'بيانات تقويم اللعبة غير صحيحة.',
};
const errMsg = (e) => {
  const raw = e?.message || String(e);
  const code = Object.keys(ERRORS).find((k) => raw.includes(k));
  return code ? ERRORS[code] : raw;
};
const creditLabel = (v) =>
  v >= 800 ? 'ممتاز' : v >= 650 ? 'جيد' : v >= 450 ? 'متوسط' : v >= 300 ? 'ضعيف' : 'خطر';
const dayText = (d) =>
  d == null ? 'لا توجد قروض' : d >= 0 ? `${d} يوم` : `متأخر ${-d} يوم`;

/* ------------------------------------------------------------ pieces */
function Ring({ score }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className={s.ring} role="img"
         aria-label={`التصنيف الائتماني ${score} من 1000`}>
      <circle cx="50" cy="50" r={r} className={s.ringBg} />
      <circle cx="50" cy="50" r={r} className={s.ringFg}
              strokeDasharray={c} strokeDashoffset={c * (1 - score / 1000)}
              transform="rotate(-90 50 50)" />
      <text x="50" y="55" textAnchor="middle" className={s.ringNum}>{score}</text>
    </svg>
  );
}

function Stat({ label, value, sub, tone, wide, i }) {
  return (
    <div className={`${s.card} ${wide ? s.wide : ''} ${tone ? s[tone] : ''}`} style={{ '--i': i }}>
      <span className={s.label}>{label}</span>
      <strong className={s.value}>{value}</strong>
      {sub ? <span className={s.sub}>{sub}</span> : null}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className={s.overlay} onMouseDown={onClose}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-label={title}
           onMouseDown={(e) => e.stopPropagation()}>
        <h2 className={s.modalTitle}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Row({ k, v, strong }) {
  return (
    <div className={`${s.kv} ${strong ? s.kvStrong : ''}`}>
      <span>{k}</span><b>{v}</b>
    </div>
  );
}

/* ------------------------------------------------------- loan request */
function RequestModal({ cal, onClose, onDone }) {
  const [mil, setMil] = useState(50);
  const [quote, setQuote] = useState(null);
  const [step, setStep] = useState('form');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const key = useRef(newKey());
  const valid = Number.isInteger(mil) && mil >= 10 && mil <= 300;
  const due = cal.gameDay < cal.midDay ? cal.midDay : cal.midDay + cal.seasonLen;

  useEffect(() => {
    if (!valid) { setQuote(null); return undefined; }
    let off = false;
    const t = setTimeout(async () => {
      try { const q = await quoteLoan(mil * UNIT); if (!off) { setQuote(q); setErr(''); } }
      catch (e) { if (!off) setErr(errMsg(e)); }
    }, 250);
    return () => { off = true; clearTimeout(t); };
  }, [mil, valid]);

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const res = await requestLoan({
        amount: mil * UNIT, season: cal.season, club: cal.clubId,
        gameDay: cal.gameDay, midDay: cal.midDay, seasonLen: cal.seasonLen, key: key.current,
      });
      await onDone(res);
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  return (
    <Modal title={step === 'form' ? 'طلب قرض جديد' : 'تأكيد القرض'} onClose={onClose}>
      {step === 'form' ? (
        <>
          <label className={s.field}>
            <span>المبلغ (مليون)</span>
            <input type="number" min="10" max="300" step="1" value={Number.isNaN(mil) ? '' : mil}
                   onChange={(e) => setMil(e.target.value === '' ? NaN : Number(e.target.value))} />
          </label>
          <input type="range" min="10" max="300" step="1" className={s.range}
                 value={valid ? mil : 10} onChange={(e) => setMil(Number(e.target.value))}
                 aria-label="مبلغ القرض" />
          {quote && valid ? (
            <div className={s.sum}>
              <Row k="نسبة الفائدة" v={`${quote.rate}%`} />
              <Row k="الفائدة (مرة واحدة)" v={M(quote.interest)} />
              <Row k="إجمالي المطلوب سداده" v={M(quote.total_due)} strong />
              <Row k="موعد السداد" v={`بعد ${due - cal.gameDay} يوم`} />
            </div>
          ) : null}
          {!valid ? <p className={s.err}>المبلغ لازم يكون رقم صحيح من 10 إلى 300 مليون.</p> : null}
          {err ? <p className={s.err}>{err}</p> : null}
          <div className={s.actions}>
            <button className={s.ghost} onClick={onClose}>إلغاء</button>
            <button className={s.primary} disabled={!valid || !quote} onClick={() => setStep('confirm')}>
              متابعة
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={s.sum}>
            <Row k="المبلغ الذي سيضاف لميزانية النادي" v={M(mil * UNIT)} />
            <Row k="الفائدة" v={`${M(quote.interest)} (${quote.rate}%)`} />
            <Row k="إجمالي المطلوب سداده" v={M(quote.total_due)} strong />
            <Row k="موعد السداد" v={`بعد ${due - cal.gameDay} يوم`} />
          </div>
          <p className={s.warn}>التأخر عن الموعد يعرّض النادي لغرامات وقيود على الانتقالات.</p>
          {err ? <p className={s.err}>{err}</p> : null}
          <div className={s.actions}>
            <button className={s.ghost} disabled={busy} onClick={() => setStep('form')}>رجوع</button>
            <button className={s.primary} disabled={busy} onClick={submit}>
              {busy ? 'جاري التنفيذ...' : 'تأكيد القرض'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------- repay */
function RepayModal({ loan, cal, budget, onClose, onDone }) {
  const out = outstanding(loan);
  const [val, setVal] = useState(out / UNIT);
  const [full, setFull] = useState(true);
  const [step, setStep] = useState('form');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const key = useRef(newKey());
  const amount = full ? out : Math.min(out, Math.round(Number(val) * UNIT));
  const valid = amount > 0;
  const short = budget != null && amount > budget;

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const res = await repayLoan({ loanId: loan.id, amount, gameDay: cal.gameDay, key: key.current });
      await onDone(res);
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  return (
    <Modal title={step === 'form' ? 'سداد القرض' : 'تأكيد السداد'} onClose={onClose}>
      {step === 'form' ? (
        <>
          <div className={s.sum}>
            <Row k="المتبقي على القرض" v={M(out)} strong />
            <Row k="رصيد النادي" v={M(budget)} />
          </div>
          <label className={s.field}>
            <span>مبلغ السداد (مليون)</span>
            <input type="number" min="0" step="0.1" value={full ? out / UNIT : val}
                   onChange={(e) => { setFull(false); setVal(e.target.value); }} />
          </label>
          <button className={s.link} onClick={() => { setFull(true); setVal(out / UNIT); }}>
            سداد كامل المتبقي
          </button>
          {short ? <p className={s.err}>رصيد النادي لا يكفي لهذا المبلغ.</p> : null}
          <div className={s.actions}>
            <button className={s.ghost} onClick={onClose}>إلغاء</button>
            <button className={s.primary} disabled={!valid || short} onClick={() => setStep('confirm')}>
              متابعة
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={s.sum}>
            <Row k="سيتم خصمه من ميزانية النادي" v={M(amount)} strong />
            <Row k="المتبقي بعد السداد" v={M(out - amount)} />
          </div>
          {err ? <p className={s.err}>{err}</p> : null}
          <div className={s.actions}>
            <button className={s.ghost} disabled={busy} onClick={() => setStep('form')}>رجوع</button>
            <button className={s.primary} disabled={busy} onClick={submit}>
              {busy ? 'جاري التنفيذ...' : 'تأكيد السداد'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* --------------------------------------------------------- reschedule */
function RescheduleModal({ loan, cal, onClose, onDone }) {
  const [days, setDays] = useState(30);
  const [quote, setQuote] = useState(null);
  const [step, setStep] = useState('form');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const key = useRef(newKey());

  useEffect(() => {
    let off = false;
    quoteReschedule(loan.id, days, cal.gameDay)
      .then((q) => { if (!off) { setQuote(q); setErr(''); } })
      .catch((e) => { if (!off) setErr(errMsg(e)); });
    return () => { off = true; };
  }, [days, loan.id, cal.gameDay]);

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const res = await rescheduleLoan({ loanId: loan.id, days, gameDay: cal.gameDay, key: key.current });
      await onDone(res);
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  return (
    <Modal title={step === 'form' ? 'إعادة جدولة القرض' : 'تأكيد إعادة الجدولة'} onClose={onClose}>
      {step === 'form' ? (
        <>
          <div className={s.choices} role="radiogroup" aria-label="مدة التمديد">
            {[15, 30, 60].map((d) => (
              <button key={d} role="radio" aria-checked={days === d}
                      className={`${s.choice} ${days === d ? s.on : ''}`} onClick={() => setDays(d)}>
                {d} يوم
              </button>
            ))}
          </div>
          {quote ? (
            <div className={s.sum}>
              <Row k="رسوم التمديد" v={M(quote.fee)} />
              <Row k="الموعد الجديد" v={`بعد ${quote.new_due_day - cal.gameDay} يوم`} />
              <Row k="إجمالي المتبقي بعد التمديد" v={M(quote.new_total_outstanding)} strong />
            </div>
          ) : null}
          {err ? <p className={s.err}>{err}</p> : null}
          <div className={s.actions}>
            <button className={s.ghost} onClick={onClose}>إلغاء</button>
            <button className={s.primary} disabled={!quote} onClick={() => setStep('confirm')}>متابعة</button>
          </div>
        </>
      ) : (
        <>
          <div className={s.sum}>
            <Row k="مدة التمديد" v={`${days} يوم`} />
            <Row k="الرسوم المضافة للدين" v={M(quote.fee)} />
            <Row k="الموعد الجديد" v={`بعد ${quote.new_due_day - cal.gameDay} يوم`} />
            <Row k="إجمالي المتبقي" v={M(quote.new_total_outstanding)} strong />
          </div>
          {err ? <p className={s.err}>{err}</p> : null}
          <div className={s.actions}>
            <button className={s.ghost} disabled={busy} onClick={() => setStep('form')}>رجوع</button>
            <button className={s.primary} disabled={busy} onClick={submit}>
              {busy ? 'جاري التنفيذ...' : 'تأكيد إعادة الجدولة'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* --------------------------------------------------------------- page */
export default function BankPage() {
  const cal = useGameCalendar();
  const bud = useClubBudget();
  const connected = Boolean(cal?.connected && bud?.connected);

  const applyRef = useRef(bud?.applyToBudget);
  applyRef.current = bud?.applyToBudget;

  const [status, setStatus] = useState(null);
  const [loans, setLoans] = useState([]);
  const [history, setHistory] = useState([]);
  const [notices, setNotices] = useState([]);
  const [tab, setTab] = useState('loans');
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!connected) return;
    try {
      const pen = await processPenalties(cal.gameDay);
      if (pen?.new_stages?.length) {
        setNotices((n) => [
          ...pen.new_stages.map((x) => ({ id: `${x.loan_id}-${x.stage}`, text: NOTICE_TEXT[x.stage] })),
          ...n,
        ]);
      }
      await syncBankCash((d) => applyRef.current(d));
      const [st, ls, tx, pn] = await Promise.all([
        getBankStatus(cal.gameDay, cal.season), getLoans(), getHistory(), getPenalties(),
      ]);
      setStatus(st);
      setLoans(ls);
      setHistory([
        ...tx.map((t) => ({ id: t.id, at: t.created_at, text: TX_TEXT[t.kind] || t.kind, amount: t.amount, day: t.game_day, kind: t.kind })),
        ...pn.map((p) => ({ id: p.id, at: p.created_at, text: PEN_TEXT[p.kind] || p.kind,
                            amount: p.amount, day: p.game_day, kind: 'penalty', points: p.points_deducted })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at)));
      setError('');
    } catch (e) { setError(errMsg(e)); }
  }, [connected, cal?.gameDay, cal?.season]);

  useEffect(() => { refresh(); }, [refresh]);

  const done = async () => { setModal(null); await refresh(); };

  if (!connected) {
    return (
      <main className={s.page}>
        <div className={s.bg} /><div className={s.shade} />
        <div className={s.wrap}>
          <div className={`${s.card} ${s.notice}`} style={{ marginTop: '30vh' }}>
            <strong className={s.value}>البنك غير متصل باللعبة</strong>
            <span className={s.sub}>افتح الملف lib/bankAdapter.js واربط تقويم اللعبة وميزانية النادي.</span>
          </div>
        </div>
      </main>
    );
  }

  const st = status;
  const blocked = st?.loans_blocked;

  return (
    <main className={s.page}>
      <div className={s.bg} /><div className={s.shade} />
      <div className={s.wrap}>
        <header className={s.head}>
          <h1 className={s.title}>بنك GSM</h1>
          <span className={s.day}>اليوم {cal.gameDay}</span>
        </header>

        {notices.map((n) => (
          <div key={n.id} className={s.banner} role="alert">
            <span>{n.text}</span>
            <button className={s.x} aria-label="إغلاق" onClick={() => setNotices((l) => l.filter((x) => x.id !== n.id))}>×</button>
          </div>
        ))}
        {st?.financial_crisis ? <div className={s.banner} role="alert">النادي في أزمة مالية: يمكن للبنك إجبارك على بيع لاعب لتغطية الدين.</div> : null}
        {st?.transfers_frozen ? <div className={s.banner}>تم تجميد {st.frozen_transfer_pct}% من ميزانية الانتقالات ومنع التعاقد مع لاعبين جدد.</div> : null}
        {st?.points_deducted_season ? <div className={s.banner}>تم خصم {st.points_deducted_season} نقاط من ترتيب الدوري هذا الموسم.</div> : null}
        {error ? <div className={s.banner} role="alert">{error}</div> : null}

        <section className={s.stage}>
          <div className={s.colL}>
            <Stat i={0} label="رصيد النادي" value={M(bud.budget)} />
            <Stat i={1} label="إجمالي القروض" value={M(st?.active_principal)} />
            <Stat i={2} wide label="إجمالي الديون" value={M(st?.total_debt)} tone={st?.total_debt > 0 ? 'bad' : ''} />
          </div>

          <div className={s.colC}>
            <div className={s.cta}>
              <button className={s.primary} disabled={blocked} onClick={() => setModal({ type: 'request' })}>
                طلب قرض جديد
              </button>
              {blocked ? <small className={s.ctaNote}>القروض الجديدة ممنوعة حتى سداد المتأخرات</small> : null}
            </div>
          </div>

          <div className={s.colR}>
            <Stat i={3} label="إجمالي الفوائد" value={M(st?.total_interest)} />
            <Stat i={4} label="موعد السداد القادم" value={dayText(st?.days_left)}
                  tone={st?.days_left != null && st.days_left < 0 ? 'bad' : ''} />
            <div className={`${s.card} ${s.wide} ${s.credit}`} style={{ '--i': 5 }}>
              <Ring score={st?.credit_score ?? 0} />
              <div>
                <span className={s.label}>التصنيف الائتماني</span>
                <strong className={s.value}>{creditLabel(st?.credit_score ?? 0)}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className={s.panel}>
          <div className={s.tabs} role="tablist">
            <button role="tab" aria-selected={tab === 'loans'} className={tab === 'loans' ? s.tabOn : ''} onClick={() => setTab('loans')}>القروض</button>
            <button role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? s.tabOn : ''} onClick={() => setTab('history')}>سجل المعاملات</button>
          </div>

          {tab === 'loans' ? (
            loans.length === 0 ? <p className={s.empty}>لا توجد قروض بعد. اطلب قرضك الأول من الزر بالأعلى.</p> : (
              <ul className={s.list}>
                {loans.map((l) => (
                  <li key={l.id} className={s.item}>
                    <div className={s.itemMain}>
                      <b>{M(l.principal)}</b>
                      <span>فائدة {l.interest_rate}%</span>
                      <span>{l.status === 'paid' ? 'مسدد' : `المتبقي ${M(outstanding(l))}`}</span>
                      <span>{l.status === 'paid' ? '' : `الموعد ${dayText(l.due_game_day - cal.gameDay)}`}</span>
                      {l.penalty_stage > 0 && l.status === 'active' ? <span className={s.tag}>{STAGE_TEXT[l.penalty_stage]}</span> : null}
                    </div>
                    {l.status === 'active' ? (
                      <div className={s.itemBtns}>
                        <button className={s.small} onClick={() => setModal({ type: 'repay', loan: l })}>سداد</button>
                        <button className={s.smallGhost} onClick={() => setModal({ type: 'resch', loan: l })}>إعادة جدولة</button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )
          ) : history.length === 0 ? <p className={s.empty}>لا توجد معاملات بعد.</p> : (
            <ul className={s.list}>
              {history.map((h) => (
                <li key={h.id} className={s.item}>
                  <div className={s.itemMain}>
                    <b>{h.text}</b>
                    {Number(h.amount) > 0 ? <span>{M(h.amount)}</span> : null}
                    {h.points ? <span>{h.points} نقاط</span> : null}
                    <span>يوم {h.day}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {modal?.type === 'request' ? <RequestModal cal={cal} onClose={() => setModal(null)} onDone={done} /> : null}
      {modal?.type === 'repay' ? <RepayModal loan={modal.loan} cal={cal} budget={bud.budget} onClose={() => setModal(null)} onDone={done} /> : null}
      {modal?.type === 'resch' ? <RescheduleModal loan={modal.loan} cal={cal} onClose={() => setModal(null)} onDone={done} /> : null}
    </main>
  );
}
