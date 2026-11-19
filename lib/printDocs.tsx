/**
 * Printable federation documents: a club's team sheet and a transfer sheet.
 *
 * Plain components with their own stylesheet rather than the site's, so the
 * live print pages and any PDF made from them look identical, on any
 * printer, in black and grey. A4 portrait.
 */

export const PRINT_CSS = `
  .rl-doc { font-family: var(--font-poppins, "Segoe UI"), "Segoe UI", system-ui, sans-serif; color: #111; background: #fff;
            width: 190mm; margin: 0 auto; font-size: 10.5pt; line-height: 1.4; }
  .rl-doc * { box-sizing: border-box; }
  .rl-head { display: flex; align-items: center; gap: 5mm; border-bottom: 1.2pt solid #111; padding-bottom: 3mm; }
  .rl-head img { width: 14mm; height: 16mm; object-fit: contain; }
  .rl-org { font-size: 8.5pt; letter-spacing: 2.5pt; color: #444; }
  .rl-title { font-size: 17pt; font-weight: 700; letter-spacing: .5pt; margin: 1mm 0 0; }
  .rl-ref { margin-left: auto; text-align: right; font-size: 8.5pt; color: #444; }
  .rl-ref b { display: block; font-size: 11pt; color: #111; letter-spacing: 1pt; }
  .rl-flag { display: flex; height: 1.4mm; margin-top: 1.2mm; }
  .rl-flag i { flex: 1; } .rl-flag i:nth-child(1){background:#ce1126} .rl-flag i:nth-child(2){background:#fcd116} .rl-flag i:nth-child(3){background:#006b3f}
  .rl-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm 5mm; margin: 4mm 0; }
  .rl-k { font-size: 7.5pt; letter-spacing: 1.5pt; color: #666; text-transform: uppercase; }
  .rl-v { font-size: 10.5pt; font-weight: 600; }
  .rl-h2 { font-size: 10pt; letter-spacing: 2pt; text-transform: uppercase; margin: 4mm 0 1.5mm; border-bottom: .6pt solid #999; padding-bottom: 1mm; }
  table.rl-t { width: 100%; border-collapse: collapse; }
  .rl-t th { font-size: 7.5pt; letter-spacing: 1.2pt; text-transform: uppercase; color: #555; text-align: left; padding: 1.2mm 2mm; border-bottom: .8pt solid #111; }
  .rl-t td { padding: .6mm 2mm; font-size: 9.5pt; border-bottom: .4pt solid #bbb; vertical-align: middle; }
  .rl-t td.no { width: 14mm; text-align: center; font-weight: 700; font-size: 11pt; }
  .rl-t td.no span { display: inline-block; min-width: 9mm; border-bottom: .6pt solid #999; }
  .rl-t td.blank { height: 6mm; }
  .rl-t.compact td { padding: .2mm 2mm; font-size: 9pt; } .rl-t.compact td.blank { height: 5mm; }
  .rl-t td.mono, .rl-mono { font-family: Consolas, "Courier New", monospace; font-size: 8.5pt; color: #444; }
  .rl-sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 3mm; }
  .rl-sig { border: .6pt solid #999; border-radius: 1.5mm; padding: 2.5mm 3.5mm; break-inside: avoid; }
  .rl-sig .who { font-weight: 700; font-size: 10pt; }
  .rl-sig .role { font-size: 8pt; color: #555; }
  .rl-stamp { margin-top: 2mm; border: .8pt solid #111; border-radius: 1mm; padding: 1.6mm 2.4mm; font-size: 8pt; line-height: 1.35; }
  .rl-stamp b { letter-spacing: 1.2pt; font-size: 7.5pt; }
  .rl-stamp.missing { border-style: dashed; color: #777; }
  .rl-line { margin-top: 5.5mm; border-top: .6pt solid #111; font-size: 7.5pt; color: #555; padding-top: .8mm; display: flex; justify-content: space-between; }
  .rl-note { font-size: 8.5pt; color: #444; margin-top: 3mm; }
  .rl-foot { display: flex; align-items: flex-end; gap: 5mm; margin-top: 4mm; break-inside: avoid; border-top: .6pt solid #999; padding-top: 3mm; font-size: 8pt; color: #555; }
  .rl-foot img { width: 21mm; height: 21mm; }
  .rl-party { display: grid; grid-template-columns: 1fr 12mm 1fr; align-items: center; margin: 4mm 0; }
  .rl-party .club { border: .6pt solid #999; border-radius: 1.5mm; padding: 3mm; text-align: center; }
  .rl-party .club img { width: 13mm; height: 13mm; object-fit: contain; display: block; margin: 0 auto 1mm; }
  .rl-party .arrow { text-align: center; font-size: 16pt; }
  .rl-player { display: flex; gap: 5mm; align-items: center; margin-top: 4mm; }
  .rl-player img, .rl-player .ph { width: 21mm; height: 26mm; object-fit: cover; object-position: top; border: .6pt solid #999; border-radius: 1.5mm; }
  .rl-player .ph { display: flex; align-items: center; justify-content: center; font-size: 18pt; color: #999; font-weight: 700; }
  .rl-example { border: 1pt solid #111; text-align: center; font-weight: 700; letter-spacing: 3pt; padding: 1.5mm; margin-bottom: 3mm; font-size: 9pt; }
  .rl-desk { background: #e9e9e9; min-height: 100vh; padding: 16px 0; }
  .rl-paper { background: #fff; width: 210mm; margin: 0 auto; padding: 10mm; box-shadow: 0 2px 12px rgba(0,0,0,.12); }
  @media print { .rl-desk { background: #fff !important; padding: 0 !important; min-height: 0; }
                 .rl-paper { width: auto; padding: 0; margin: 0; box-shadow: none; } }
  @page { size: A4; margin: 10mm; }
  @media print { .rl-noprint { display: none !important; } body { background: #fff !important; } }
`;

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
const fmtStamp = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }) + " GMT"
    : null;

function Head({ crest, title, refLabel, refValue }: { crest: string; title: string; refLabel: string; refValue: string }) {
  return (
    <>
      <div className="rl-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={crest} alt="" />
        <div>
          <div className="rl-org">RUGBY LEAGUE FEDERATION GHANA</div>
          <div className="rl-title">{title}</div>
        </div>
        <div className="rl-ref">
          {refLabel}
          <b>{refValue}</b>
        </div>
      </div>
      <div className="rl-flag">
        <i />
        <i />
        <i />
      </div>
    </>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="rl-k">{k}</div>
      <div className="rl-v">{v}</div>
    </div>
  );
}

// ---------------------------------------------------------------- team sheet

export type TeamSheetData = {
  crest: string;
  club: string;
  opponent: string;
  home: boolean;
  competition: string;
  round: string | null;
  date: string | null;
  time: string | null;
  venue: string | null;
  status: string;
  submittedAt: string | null;
  headCoach: string | null;
  assistantCoach: string | null;
  starters: { jersey: number | null; name: string; position: string | null; card: string }[];
  bench: { jersey: number | null; name: string; position: string | null; card: string }[];
  example?: boolean;
};

function Rows({ rows, blanks, compact }: { rows: TeamSheetData["starters"]; blanks: number; compact?: boolean }) {
  return (
    <table className={compact ? "rl-t compact" : "rl-t"}>
      <thead>
        <tr>
          <th style={{ textAlign: "center" }}>No.</th>
          <th>Player</th>
          <th>Position</th>
          <th>Card no.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {/* No number entered: left blank to write in by hand. */}
            <td className="no">
              <span>{r.jersey ?? " "}</span>
            </td>
            <td>{r.name}</td>
            <td>{r.position ?? ""}</td>
            <td className="mono">{r.card}</td>
          </tr>
        ))}
        {Array.from({ length: blanks }).map((_, i) => (
          <tr key={`b${i}`}>
            <td className="no blank">
              <span>{" "}</span>
            </td>
            <td className="blank" />
            <td className="blank" />
            <td className="blank" />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TeamSheetDoc({ d }: { d: TeamSheetData }) {
  const fixture = d.home ? `${d.club} v ${d.opponent}` : `${d.opponent} v ${d.club}`;
  // More names than a matchday squad: tighter rows, so it still fits one page.
  const big = d.starters.length + d.bench.length > 17;
  return (
    <div className="rl-doc">
      {/* Raw, so quoted font names survive server rendering. */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      {d.example && <div className="rl-example">EXAMPLE</div>}
      <Head crest={d.crest} title="Official Team Sheet" refLabel="Status" refValue={d.status.toUpperCase()} />

      <div className="rl-grid">
        <KV k="Club" v={d.club} />
        <KV k="Match" v={fixture} />
        <KV k="Competition" v={[d.competition, d.round].filter(Boolean).join(" · ")} />
        <KV k="Date" v={`${fmtDate(d.date)}${d.time ? `, ${d.time.slice(0, 5)}` : ""}`} />
        <KV k="Venue" v={d.venue ?? "—"} />
        <KV k="Head coach" v={d.headCoach ?? "—"} />
        <KV k="Assistant coach" v={d.assistantCoach ?? "—"} />
        <KV k="Submitted" v={d.submittedAt ? fmtDate(d.submittedAt) : "Not yet"} />
      </div>

      <div className="rl-h2">Starting side ({d.starters.length})</div>
      <Rows rows={d.starters} blanks={Math.max(0, 13 - d.starters.length)} compact={big} />

      <div className="rl-h2">Interchange ({d.bench.length})</div>
      {/* Room for late changes, without pushing the signatures off the page. */}
      <Rows rows={d.bench} blanks={big ? 1 : 2} compact={big} />

      <p className="rl-note">
        A blank number is to be written in by hand before kick-off. Card numbers match each player&rsquo;s RLFG ID card. Players not on this
        sheet may not take part.
      </p>

      <div className="rl-sigs">
        <div className="rl-sig">
          <div className="who">Club official</div>
          <div className="role">Team manager or head coach, for {d.club}</div>
          <div className="rl-line">
            <span>Name &amp; signature</span>
            <span>Date</span>
          </div>
        </div>
        <div className="rl-sig">
          <div className="who">Match commissioner</div>
          <div className="role">Checked against ID cards before kick-off</div>
          <div className="rl-line">
            <span>Name &amp; signature</span>
            <span>Date</span>
          </div>
        </div>
      </div>

      <div className="rl-foot">
        <span>Printed from the RLFG platform · rl-db.vercel.app · {fmtDate(new Date().toISOString())}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- transfer sheet

export type Signature = {
  party: string; // "Buying club"
  name: string; // "Bulls RLFC"
  by: string | null; // the account that signed
  at: string | null; // when
  what: string; // "Requested the transfer"
};

export type TransferSheetData = {
  crest: string;
  reference: string;
  kind: "transfer" | "loan";
  loanUntil: string | null;
  player: { name: string; card: string; position: string | null; grade: string | null; photo: string | null };
  from: { name: string; logo: string | null };
  to: { name: string; logo: string | null };
  fee: number | null;
  levy: number | null;
  effective: string | null;
  signatures: Signature[];
  qr: string;
  verifyUrl: string;
  /** The General Manager's signature, shown in the federation's box. */
  federationSignature?: { img: string; name: string; title: string } | null;
  example?: boolean;
};

const lx = (n: number | null) => (n == null ? "—" : `${Math.round(n).toLocaleString("en-GB")} LX`);

export function TransferSheetDoc({ d }: { d: TransferSheetData }) {
  const loan = d.kind === "loan";
  const total = (d.fee ?? 0) + (d.levy ?? 0);
  return (
    <div className="rl-doc">
      {/* Raw, so quoted font names survive server rendering. */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      {d.example && <div className="rl-example">EXAMPLE · NOT A REAL TRANSFER</div>}
      <Head crest={d.crest} title={loan ? "Loan Agreement" : "Transfer Certificate"} refLabel="Reference" refValue={d.reference} />

      <div className="rl-player">
        {d.player.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.player.photo} alt="" />
        ) : (
          <div className="ph">{d.player.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}</div>
        )}
        <div style={{ flex: 1 }}>
          <div className="rl-k">Player</div>
          <div style={{ fontSize: "16pt", fontWeight: 700 }}>{d.player.name}</div>
          <div className="rl-mono">ID card {d.player.card}</div>
          <div style={{ fontSize: "9.5pt", color: "#444" }}>{[d.player.position, d.player.grade].filter(Boolean).join(" · ")}</div>
        </div>
      </div>

      <div className="rl-party">
        <div className="club">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.from.logo && <img src={d.from.logo} alt="" />}
          <div className="rl-k">From</div>
          <div className="rl-v">{d.from.name}</div>
        </div>
        <div className="arrow">→</div>
        <div className="club">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.to.logo && <img src={d.to.logo} alt="" />}
          <div className="rl-k">To</div>
          <div className="rl-v">{d.to.name}</div>
        </div>
      </div>

      <div className="rl-grid">
        <KV k="Type" v={loan ? "Loan" : "Permanent transfer"} />
        <KV k="Effective" v={fmtDate(d.effective)} />
        <KV k={loan ? "Loan ends" : "Registration"} v={loan ? fmtDate(d.loanUntil) : `With ${d.to.name}`} />
        <KV k="Fee to selling club" v={lx(d.fee)} />
        <KV k="Federation levy (10%)" v={lx(d.levy)} />
        <KV k="Total paid" v={lx(total)} />
      </div>

      <p className="rl-note" style={{ marginTop: 0 }}>
        {loan
          ? `${d.player.name} is registered to play for ${d.to.name} on loan from ${d.from.name} until ${fmtDate(d.loanUntil)}, after which the registration returns to ${d.from.name}.`
          : `The registration of ${d.player.name} passes from ${d.from.name} to ${d.to.name} from the effective date above.`}{" "}
        Fees are in LeagueX (LX) and have been settled on the federation&rsquo;s ledger.
      </p>
      <p className="rl-note" style={{ marginTop: "1.5mm", fontWeight: 600 }}>
        LeagueX is not real money. It is a points currency used only inside the RLFG platform to balance transfers between clubs: it has
        no cash value and cannot be bought, sold, paid out or exchanged for money.
      </p>

      <div className="rl-h2">Signatures</div>
      <div className="rl-sigs">
        {d.signatures.map((s) => (
          <div key={s.party} className="rl-sig">
            <div className="who">{s.name}</div>
            <div className="role">{s.party}</div>
            {s.at ? (
              <div className="rl-stamp">
                <b>ELECTRONICALLY SIGNED</b>
                <br />
                {s.what}
                <br />
                {fmtStamp(s.at)}
                {s.by ? (
                  <>
                    <br />
                    by {s.by}
                  </>
                ) : null}
              </div>
            ) : (
              <div className="rl-stamp missing">Awaiting signature</div>
            )}
            {s.party === "Federation" && d.federationSignature?.img ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.federationSignature.img} alt="" style={{ height: "13mm", maxWidth: "60mm", objectFit: "contain", objectPosition: "left bottom", display: "block", marginTop: "2mm" }} />
                <div className="rl-line" style={{ marginTop: 0 }}>
                  <span>
                    {d.federationSignature.name}, {d.federationSignature.title}
                  </span>
                  <span>{s.at ? new Date(s.at).toLocaleDateString("en-GB") : ""}</span>
                </div>
              </>
            ) : (
              <div className="rl-line">
                <span>Signature (optional, in ink)</span>
                <span>Date</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rl-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={d.qr} alt="" />
        <span>
          Each party signed by approving this {loan ? "loan" : "transfer"} in their own RLFG account; the times above are recorded by the
          federation. Scan the code to confirm this sheet is genuine: a copy with any detail changed will not match.
          <br />
          <span className="rl-mono">{d.verifyUrl}</span>
        </span>
      </div>
    </div>
  );
}
