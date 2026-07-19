/* ===========================================================================
   beratung-shared.js  (v2 – visuelle A4-Zusammenfassung)
   ---------------------------------------------------------------------------
   Gemeinsames Modul für alle Beratungstools.

   Leistet zwei Dinge:
   1) KUNDENDATEN  – liest die im Index erfassten Daten (Person 1, Partner,
                     Kinder) aus dem localStorage und trägt sie automatisch
                     in die passenden Felder des jeweiligen Tools ein.
   2) ZUSAMMENFASSUNG – erzeugt auf Knopfdruck eine kompakte, druckfertige
                     Zusammenfassung auf 1 A4-Seite: Hero-Kennzahl, farbige
                     Karten, optionales Balkendiagramm, kompakte Kennzahlen,
                     Notizen, Stempel-/Unterschriftsfeld und Rechtshinweis.

   Es werden KEINE bestehenden Berechnungen verändert.

   Einbindung am Ende der jeweiligen Tool-Datei:
       <script>window.BERATUNG_CONFIG = { ... };</script>
       <script src="beratung-shared.js"></script>

   ---------------------------------------------------------------------------
   BERATUNG_CONFIG – Aufbau (alle Felder optional außer titel):
   ---------------------------------------------------------------------------
   {
     titel:      'Tool-Name',
     untertitel: 'Kurzbeschreibung',

     hero: {                          // große zentrale Kennzahl
       label: 'Ihr finanzieller Spielraum',
       sel:   '#maxDarlehensrate',    // ODER wert: function(){...}
       sub:   'pro Monat für Wohneigentum'
     },

     cards: [                         // 2..4 farbige Kacheln
       { farbe:'gruen',  titel:'Komfortabel', sel:'#komfortHauspreis',
         subSel:'#komfortRate', subPrefix:'bei ', subSuffix:' / Monat' },
       { farbe:'orange', titel:'Ausgewogen',  sel:'#ausgewogenHauspreis' },
       { farbe:'rot',    titel:'Obergrenze',  sel:'#obergrenzeHauspreis' }
     ],
     // farbe: 'gruen' | 'orange' | 'rot' | 'blau' | 'grau'

     chart: {                         // optionales SVG-Balkendiagramm
       titel: 'Vergleich',
       balken: [
         { label:'Alt', sel:'#endAlt',  farbe:'#6b7280' },
         { label:'Neu', sel:'#endNeu',  farbe:'#4e9070' },
         { label:'ETF', sel:'#endEtf',  farbe:'#ff4d0d' }
       ]
     },

     kennzahlen: [                    // kompakte 2-Spalten-Kennzahlen (statt Abschnitte)
       { label:'Sparrate', sel:'#rate', suffix:' €' },
       { label:'Laufzeit', sel:'#dauer', hervor:true }
     ],

     notizenZeilen: 4,                // Anzahl Notizzeilen (Standard 4)

     // Fallback: wenn KEIN hero/cards/chart/kennzahlen definiert ist, wird
     // die alte Abschnitts-Tabelle als Kompaktvariante gerendert.
     abschnitte: [ ... ],
     hinweise:   [ ... ]              // optional, dezent unter den Notizen
   }
   =========================================================================== */
(function () {
  'use strict';

  var KEY = 'beratung_kunde';

  /* =========================================================================
     ZENTRALER VERMERK
     ========================================================================= */
  var VERMERK_KURZ =
    'Kein offizielles Dokument · privat erstelltes Arbeitsmittel · ' +
    'unverbindliche Beispielrechnung · kein Angebot';
  var VERMERK_TEXT =
    'Diese Übersicht ist ein privat erstelltes Arbeitsmittel zur ' +
    'Gesprächsunterstützung und kein offizielles Dokument. Alle Werte sind ' +
    'unverbindliche Beispielrechnungen und stellen kein Angebot, keine ' +
    'Zusage und keine individuelle Anlage-, Steuer- oder Rechtsberatung dar. ' +
    'Verbindlich sind ausschließlich die offiziellen Unterlagen des Anbieters.';

  /* =========================================================================
     1) DATENHALTUNG
     ========================================================================= */
  function normalize(k) {
    k = k && typeof k === 'object' ? k : {};
    k.vorname = k.vorname || '';
    k.nachname = k.nachname || '';
    k.geburtsdatum = k.geburtsdatum || '';
    k.partner = k.partner && typeof k.partner === 'object' ? k.partner : {};
    k.partner.aktiv = !!k.partner.aktiv;
    k.partner.vorname = k.partner.vorname || '';
    k.partner.nachname = k.partner.nachname || '';
    k.partner.geburtsdatum = k.partner.geburtsdatum || '';
    k.kinder = Array.isArray(k.kinder) ? k.kinder : [];
    k.kinder = k.kinder.map(function (kind) {
      kind = kind && typeof kind === 'object' ? kind : {};
      return { vorname: kind.vorname || '', geburtsdatum: kind.geburtsdatum || '' };
    });
    return k;
  }

  function load() {
    var raw;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    return normalize(raw);
  }
  function save(obj)  { try { localStorage.setItem(KEY, JSON.stringify(normalize(obj))); } catch (e) {} }
  function clear()    { try { localStorage.removeItem(KEY); } catch (e) {} }

  /* ---------- kleine Helfer ---------- */
  function fmtDate(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : '';
  }
  function alterAus(iso) {
    if (!iso) return null;
    var d = new Date(iso); if (isNaN(d)) return null;
    var t = new Date();
    var a = t.getFullYear() - d.getFullYear();
    var m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
    return (a >= 0 && a < 120) ? a : null;
  }
  function vollerName(p) { return [p && p.vorname, p && p.nachname].filter(Boolean).join(' ').trim(); }

  function haushaltsName(k) {
    var n1 = vollerName(k);
    if (!k.partner.aktiv) return n1;
    var n2 = vollerName(k.partner);
    if (!n2) return n1;
    if (!n1) return n2;
    if (k.nachname && k.nachname === k.partner.nachname) {
      if (k.kinder.length > 0) return 'Familie ' + k.nachname;
      return [k.vorname, k.partner.vorname].filter(Boolean).join(' & ') + ' ' + k.nachname;
    }
    return n1 + ' & ' + n2;
  }
  function personenImHaushalt(k) {
    return 1 + (k.partner.aktiv ? 1 : 0) + k.kinder.length;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function fire(el, typ) { el.dispatchEvent(new Event(typ, { bubbles: true })); }
  function q(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }

  /* Liest einen Anzeigewert aus dem Tool. */
  function readValue(sel) {
    var el = q(sel); if (!el) return null;
    var tag = el.tagName, v;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (el.type === 'checkbox') return el.checked ? 'ja' : 'nein';
      if (el.type === 'date') return fmtDate(el.value);
      v = el.value;
    } else v = el.textContent;
    v = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    return v;
  }

  /* Prüft, ob ein Eintrag angezeigt werden soll (Predicate `if`) */
  function shouldShow(x) {
    if (!x || typeof x.if !== 'function') return true;
    try { return !!x.if(); } catch (e) { return true; }
  }

  /* Label kann String oder Funktion sein */
  function resolveLabel(x) {
    if (!x) return '';
    if (typeof x.label === 'function') { try { return x.label() || ''; } catch (e) { return ''; } }
    return x.label || '';
  }

  /* Wert aus {sel|wert} auslesen */
  function readSpec(z) {
    if (!z) return null;
    if (typeof z.wert === 'function') { try { return z.wert(); } catch (e) { return null; } }
    if (z.wert != null) return z.wert;
    if (z.sel) return readValue(z.sel);
    return null;
  }

  /* Untertitel einer Karte: sub (string|function), oder subSel + subPrefix/subSuffix */
  function readSub(c) {
    if (typeof c.sub === 'function') { try { return c.sub(); } catch (e) { return ''; } }
    if (c.sub) return c.sub;
    if (c.subSel) {
      var v = readValue(c.subSel);
      if (!v) return '';
      return (c.subPrefix || '') + v + (c.subSuffix || '');
    }
    return '';
  }

  /* Zahl aus formatiertem String parsen (de-DE, mit €, %, etc.) */
  function numFrom(str) {
    if (str == null) return 0;
    var s = String(str);
    // Deutsche Zahl: Punkt = Tausender, Komma = Dezimal
    var m = s.match(/-?[\d.]+(?:,\d+)?/);
    if (!m) return 0;
    var t = m[0].replace(/\./g, '').replace(',', '.');
    var n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }

  /* =========================================================================
     2) KUNDENDATEN IN DIE TOOL-FELDER ÜBERNEHMEN
     ========================================================================= */
  function applyKunde() {
    var k = load();
    var hatDaten = !!(k.vorname || k.nachname || k.geburtsdatum ||
                      k.partner.aktiv || k.kinder.length);
    if (!hatDaten) return k;

    var dob = document.getElementById('dob');
    if (dob && k.geburtsdatum && !dob.value) { dob.value = k.geburtsdatum; fire(dob, 'change'); }

    var dob2 = document.getElementById('dob2');
    if (dob2 && k.partner.aktiv && k.partner.geburtsdatum && !dob2.value) {
      dob2.value = k.partner.geburtsdatum; fire(dob2, 'change');
    }

    var kn = document.getElementById('kundenName');
    var hName = haushaltsName(k);
    if (kn && hName && !kn.value) { kn.value = hName; fire(kn, 'input'); }

    var touched = false;
    var map = [
      ['p1Vorname', k.vorname], ['p1Nachname', k.nachname],
      ['p2Vorname', k.partner.aktiv ? k.partner.vorname : ''],
      ['p2Nachname', k.partner.aktiv ? k.partner.nachname : '']
    ];
    map.forEach(function (m) {
      var el = document.getElementById(m[0]);
      if (el && m[1] && !el.value) { el.value = m[1]; touched = true; }
    });

    ['person2Aktiv', 'partnerAktiv'].forEach(function (id) {
      var sw = document.getElementById(id);
      if (sw && sw.type === 'checkbox' && k.partner.aktiv && !sw.checked) {
        sw.checked = true; fire(sw, 'change'); touched = true;
      }
    });

    var kinderEl = document.getElementById('kinder');
    if (kinderEl && k.kinder.length > 0) {
      var aktuell = Number(kinderEl.value) || 0;
      if (aktuell === 0) {
        kinderEl.value = k.kinder.length;
        fire(kinderEl, 'input'); fire(kinderEl, 'change');
        touched = true;
      }
    }

    if (touched && typeof window.calculate === 'function') {
      try { window.calculate(); } catch (e) {}
    }
    return k;
  }

  /* =========================================================================
     3) ZUSAMMENFASSUNG – Bausteine
     ========================================================================= */

  /* Kundenzeile: „Familie Müller · Anna 42 J. · Max 39 J. · 2 Kinder" */
  function kundenZeile(k) {
    var teile = [];
    var hName = haushaltsName(k);
    if (hName) teile.push(hName);

    var extras = [];
    var a1 = alterAus(k.geburtsdatum);
    if (a1 != null) extras.push((k.vorname || 'Person 1') + ' ' + a1 + ' J.');
    if (k.partner.aktiv) {
      var a2 = alterAus(k.partner.geburtsdatum);
      if (a2 != null) extras.push((k.partner.vorname || 'Partner') + ' ' + a2 + ' J.');
    }
    if (k.kinder.length) extras.push(k.kinder.length + ' Kind' + (k.kinder.length === 1 ? '' : 'er'));
    if (extras.length) teile.push(extras.join(' · '));
    return teile.join(' · ');
  }

  function heroHTML(cfg) {
    if (!cfg.hero || !shouldShow(cfg.hero)) return '';
    var v = readSpec(cfg.hero);
    if (!v || v === '–') return '';
    var sub = typeof cfg.hero.sub === 'function'
      ? (function(){ try { return cfg.hero.sub() || ''; } catch(e){ return ''; } })()
      : (cfg.hero.sub || '');
    return '<div class="hero">' +
      '<div class="ht">' + esc(resolveLabel(cfg.hero)) + '</div>' +
      '<div class="hv">' + esc(v) + '</div>' +
      (sub ? '<div class="hs">' + esc(sub) + '</div>' : '') +
      '</div>';
  }

  function cardsHTML(cfg) {
    if (!cfg.cards || !cfg.cards.length) return '';
    var farben = {
      gruen:  '#4e9070',
      orange: '#ff4d0d',
      rot:    '#c06a60',
      blau:   '#4a7ba6',
      grau:   '#6b7280'
    };
    var karten = cfg.cards.filter(shouldShow);
    if (!karten.length) return '';
    var n = karten.length;
    var html = '<div class="cards" style="grid-template-columns:repeat(' + n + ',1fr)">';
    karten.forEach(function (c) {
      var v = readSpec(c);
      if (v == null || v === '') v = '–';
      var sub = readSub(c);
      var col = farben[c.farbe] || farben.grau;
      html += '<div class="card" style="border-top-color:' + col + '">' +
        '<div class="ct" style="color:' + col + '">' + esc(resolveLabel({label:c.titel})) + '</div>' +
        '<div class="cv">' + esc(v) + '</div>' +
        (sub ? '<div class="cs">' + esc(sub) + '</div>' : '') +
        '</div>';
    });
    return html + '</div>';
  }

  function chartHTML(cfg) {
    if (!cfg.chart || !cfg.chart.balken || !cfg.chart.balken.length) return '';
    var b = cfg.chart.balken.filter(shouldShow);
    if (!b.length) return '';
    var vals = b.map(function (x) {
      var raw = readSpec(x);
      return { v: numFrom(raw), t: raw || '–', l: x.label || '', f: x.farbe || '#ff4d0d' };
    });
    var max = Math.max.apply(null, vals.map(function (x) { return x.v; })) || 1;

    var W = 560, H = 110, PAD = 10;
    var slot = (W - 2 * PAD) / vals.length;
    var barW = Math.min(90, slot - 24);
    var svg = '<svg viewBox="0 0 ' + W + ' ' + (H + 42) + '" preserveAspectRatio="xMidYMid meet" ' +
              'style="width:100%;height:auto;display:block">';
    // Grundlinie
    svg += '<line x1="' + PAD + '" y1="' + (H + 10) + '" x2="' + (W - PAD) + '" y2="' + (H + 10) +
           '" stroke="#e4e7ec" stroke-width="1"/>';
    vals.forEach(function (x, i) {
      var bh = max > 0 ? Math.max(3, (x.v / max) * (H - 6)) : 3;
      var cx = PAD + i * slot + slot / 2;
      var bx = cx - barW / 2;
      var by = H + 10 - bh;
      svg += '<rect x="' + bx + '" y="' + by + '" width="' + barW + '" height="' + bh +
             '" fill="' + x.f + '" rx="4"/>';
      svg += '<text x="' + cx + '" y="' + (by - 5) + '" text-anchor="middle" ' +
             'font-size="11" font-weight="700" fill="#20232a" ' +
             'font-family="Inter,Arial,sans-serif">' + esc(x.t) + '</text>';
      svg += '<text x="' + cx + '" y="' + (H + 28) + '" text-anchor="middle" ' +
             'font-size="10.5" fill="#4b5563" font-family="Inter,Arial,sans-serif">' +
             esc(x.l) + '</text>';
    });
    svg += '</svg>';

    return '<div class="chart">' +
      (cfg.chart.titel ? '<div class="chartTitle">' + esc(cfg.chart.titel) + '</div>' : '') +
      svg + '</div>';
  }

  function kennzahlenHTML(cfg) {
    if (!cfg.kennzahlen || !cfg.kennzahlen.length) return '';
    var eintraege = cfg.kennzahlen.filter(shouldShow);
    if (!eintraege.length) return '';
    var rows = eintraege.map(function (k) {
      var v = readSpec(k);
      if (v == null || v === '') v = '–';
      if (k.suffix && v !== '–') v = v + k.suffix;
      return '<div class="kz' + (k.hervor ? ' kzhl' : '') + '">' +
        '<span>' + esc(k.label) + '</span>' +
        '<b>' + esc(v) + '</b></div>';
    }).join('');
    return '<div class="kzgrid">' + rows + '</div>';
  }

  /* Fallback: knappe Darstellung der Abschnitte, falls keine neuen Felder gesetzt sind */
  function fallbackAbschnitte(cfg) {
    if (!cfg.abschnitte || !cfg.abschnitte.length) return '';
    var out = [];
    cfg.abschnitte.forEach(function (ab) {
      var zeilen = [];
      (ab.zeilen || []).forEach(function (z) {
        if (!z.hervor && !z.immer) return; // im Fallback nur wichtige Zeilen zeigen
        var v = readSpec(z);
        if (v == null || v === '') v = '–';
        if (z.suffix && v !== '–') v = v + z.suffix;
        zeilen.push('<div class="kz' + (z.hervor ? ' kzhl' : '') + '">' +
          '<span>' + esc(z.label) + '</span><b>' + esc(v) + '</b></div>');
      });
      if (!zeilen.length) return;
      out.push('<div class="fbSec"><div class="fbT">' + esc(ab.titel || '') + '</div>' +
               '<div class="kzgrid inner">' + zeilen.join('') + '</div></div>');
    });
    return out.join('');
  }

  /* =========================================================================
     4) DOKUMENT BAUEN
     ========================================================================= */
  function baueDokument(cfg, k) {
    var datum = new Date().toLocaleDateString('de-DE');
    var uhr = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    var kzeile = kundenZeile(k);
    var notesN = cfg.notizenZeilen || 4;

    var hasNew = !!(cfg.hero || (cfg.cards && cfg.cards.length) ||
                    (cfg.chart && cfg.chart.balken) ||
                    (cfg.kennzahlen && cfg.kennzahlen.length));

    var body = '';
    body += heroHTML(cfg);
    body += cardsHTML(cfg);
    body += chartHTML(cfg);
    body += kennzahlenHTML(cfg);
    if (!hasNew) body += fallbackAbschnitte(cfg);

    var css =
      '<style>' +
      '@page{size:A4;margin:10mm}' +
      '*{box-sizing:border-box}' +
      'body{font-family:"Inter",-apple-system,"Segoe UI",Arial,sans-serif;' +
        'color:#20232a;margin:0;padding:14px 18px;font-size:12px;line-height:1.4}' +

      /* Aktionsleiste */
      '.pb{display:flex;gap:8px;margin-bottom:12px}' +
      '.pb button{font:inherit;font-size:12px;font-weight:700;border:none;' +
        'border-radius:8px;padding:8px 14px;cursor:pointer}' +
      '.pb .pr{background:#ff4d0d;color:#fff}' +
      '.pb .cl{background:#eef0f2;color:#20232a}' +

      /* Kopf */
      '.head{display:flex;justify-content:space-between;align-items:flex-end;' +
        'border-bottom:3px solid #ff4d0d;padding-bottom:6px;margin-bottom:8px;gap:16px}' +
      '.head h1{color:#ff4d0d;margin:0;font-size:19px;letter-spacing:-.3px}' +
      '.head .sub{color:#666;font-size:11px;margin-top:1px}' +
      '.head .meta{text-align:right;font-size:11px;color:#6b7280;white-space:nowrap}' +
      '.head .meta b{display:block;color:#20232a;font-size:12px;max-width:240px;' +
        'white-space:normal;text-align:right}' +

      /* Vermerk oben (schmal) */
      '.disc-top{background:#fff5f0;border-left:3px solid #ff4d0d;padding:5px 9px;' +
        'font-size:9.5px;color:#8b3a10;margin-bottom:10px;border-radius:0 4px 4px 0;' +
        'line-height:1.35}' +

      /* Hero */
      '.hero{background:#ffece4;border:2px solid #ff4d0d;border-radius:12px;' +
        'text-align:center;padding:12px 14px;margin-bottom:10px}' +
      '.hero .ht{font-size:13px;font-weight:600;color:#20232a}' +
      '.hero .hv{font-size:36px;color:#ff4d0d;font-weight:800;line-height:1;margin:4px 0 2px;' +
        'font-variant-numeric:tabular-nums}' +
      '.hero .hs{color:#666;font-size:11px}' +

      /* Karten */
      '.cards{display:grid;gap:8px;margin-bottom:10px}' +
      '.card{background:#fff;border:1px solid #e4e7ec;border-top:4px solid #ccc;' +
        'text-align:center;padding:9px 6px;border-radius:10px}' +
      '.card .ct{font-size:11.5px;font-weight:700;letter-spacing:.2px}' +
      '.card .cv{font-size:18px;font-weight:800;margin:3px 0 1px;color:#20232a;' +
        'font-variant-numeric:tabular-nums}' +
      '.card .cs{font-size:10px;color:#777}' +

      /* Chart */
      '.chart{border:1px solid #e4e7ec;border-radius:10px;padding:8px 12px 4px;margin-bottom:10px}' +
      '.chartTitle{font-size:10.5px;color:#6b7280;text-transform:uppercase;' +
        'letter-spacing:.6px;margin-bottom:2px;font-weight:700}' +

      /* Kennzahlen */
      '.kzgrid{display:grid;grid-template-columns:1fr 1fr;gap:2px 18px;' +
        'border:1px solid #e4e7ec;border-radius:10px;padding:8px 14px;margin-bottom:10px}' +
      '.kzgrid.inner{border:none;padding:0;margin:0}' +
      '.kz{display:flex;justify-content:space-between;font-size:11.5px;' +
        'padding:4px 0;border-bottom:1px dashed #edeff2;gap:12px}' +
      '.kz:nth-last-child(-n+2){border-bottom:none}' +
      '.kz span{color:#4b5563}' +
      '.kz b{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.kz.kzhl{background:#ffece4;padding:5px 8px;margin:1px -6px;border-radius:5px;' +
        'border-bottom:none}' +
      '.kz.kzhl b,.kz.kzhl span{color:#c73a08;font-weight:700}' +

      /* Fallback-Abschnitte */
      '.fbSec{margin-bottom:8px}' +
      '.fbT{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;' +
        'letter-spacing:.5px;margin-bottom:3px}' +

      /* Notizen */
      '.notes{border:1px solid #e4e7ec;border-radius:10px;padding:8px 12px;margin-bottom:10px}' +
      '.notes .nh{font-size:10.5px;color:#6b7280;text-transform:uppercase;' +
        'letter-spacing:.6px;font-weight:700;margin-bottom:5px}' +
      '.nline{border-bottom:1px solid #d0d4d9;height:18px}' +

      /* Fuß: Ort/Datum + Stempel */
      '.foot-row{display:grid;grid-template-columns:1fr 1.3fr;gap:22px;' +
        'align-items:end;margin-bottom:8px}' +
      '.datefield .dl,.stamp .sl{font-size:10px;color:#666}' +
      '.dline{border-bottom:1px solid #888;height:22px;margin-top:14px}' +
      '.stampbox{height:58px;border:1.5px dashed #b3b3b3;border-radius:8px;margin-top:3px}' +

      /* Rechtshinweis unten */
      '.disc{text-align:center;font-size:8.5px;color:#8a8a8a;margin-top:4px;' +
        'line-height:1.4;padding:0 6px}' +

      '@media print{.pb{display:none}body{padding:8mm 6mm}}' +
      '</style>';

    return '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">' +
      '<title>' + esc(cfg.titel || 'Zusammenfassung') + ' – Zusammenfassung</title>' +
      css + '</head><body>' +

      '<div class="pb">' +
        '<button class="pr" onclick="window.print()">Drucken / als PDF speichern</button>' +
        '<button class="cl" onclick="window.close()">Schließen</button>' +
      '</div>' +

      '<div class="head">' +
        '<div><h1>' + esc(cfg.titel || 'Zusammenfassung') + '</h1>' +
          (cfg.untertitel ? '<div class="sub">' + esc(cfg.untertitel) + '</div>' : '') +
        '</div>' +
        '<div class="meta">' +
          (kzeile ? '<b>' + esc(kzeile) + '</b>' : '<b>ohne Kundendaten</b>') +
          'erstellt ' + datum + ', ' + uhr + ' Uhr' +
        '</div>' +
      '</div>' +

      '<div class="disc-top">' + esc(VERMERK_KURZ) + '</div>' +

      body +

      '<div class="notes">' +
        '<div class="nh">Notizen zum Gespräch</div>' +
        new Array(notesN).fill('<div class="nline"></div>').join('') +
      '</div>' +

      '<div class="foot-row">' +
        '<div class="datefield"><span class="dl">Ort, Datum</span><div class="dline"></div></div>' +
        '<div class="stamp"><span class="sl">Stempel &amp; Unterschrift Berater/in</span>' +
          '<div class="stampbox"></div></div>' +
      '</div>' +

      '<div class="disc">' + esc(VERMERK_TEXT) + '</div>' +

      '</body></html>';
  }

  function zusammenfassung() {
    var cfg = window.BERATUNG_CONFIG || {};
    var k = load();
    var w = window.open('', '_blank');
    if (!w) {
      alert('Das Fenster für die Zusammenfassung wurde vom Browser blockiert.\n' +
            'Bitte Pop-ups für diese Seite erlauben.');
      return;
    }
    w.document.write(baueDokument(cfg, k));
    w.document.close();
    w.focus();
    /* Sofort in den Druckdialog springen. onload deckt Fälle ab, in denen
       Fonts/Bilder noch nachladen; das Timeout ist Fallback für Browser,
       die onload im neuen Dokument nicht mehr feuern. */
    var gedruckt = false;
    var startPrint = function(){
      if (gedruckt) return;
      gedruckt = true;
      try { w.focus(); w.print(); } catch (e) {}
    };
    try { w.addEventListener('load', startPrint); } catch (e) {}
    setTimeout(startPrint, 350);
  }

  /* =========================================================================
     5) BUTTON IN DEN TOOL-HEADER EINSETZEN
     ========================================================================= */
  var ICON =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none">' +
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>' +
    '<path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';

  function baueButton() {
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'btnZusammenfassung';
    b.title = 'Kompakte Gesprächszusammenfassung (kein offizielles Dokument)';
    b.innerHTML = ICON + '<span>Zusammenfassung</span>';
    b.addEventListener('click', zusammenfassung);
    return b;
  }

  function setzeButton() {
    if (document.getElementById('btnZusammenfassung')) return;
    var cfg = window.BERATUNG_CONFIG || {};
    if (cfg.zusammenfassung === false) return;

    var btn = baueButton();
    var tools = document.querySelector('.topTools');

    /* Einheitlicher Orange-Pill-Stil, wenn kein Vorbild-Button vorhanden ist */
    function applyPillStyle(el){
      el.style.cssText =
        'height:36px;border:none;border-radius:20px;padding:0 14px;' +
        'background:rgba(255,255,255,.2);color:#fff;font-family:inherit;font-size:13px;' +
        'font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;' +
        'transition:.15s;';
      el.addEventListener('mouseenter', function(){
        el.style.background = '#fff'; el.style.color = '#ff4d0d';
      });
      el.addEventListener('mouseleave', function(){
        el.style.background = 'rgba(255,255,255,.2)'; el.style.color = '#fff';
      });
    }

    if (tools) {
      var vorbild = tools.querySelector('button, a');
      if (vorbild) {
        /* Vorhandene Button-Leiste: gleiche Optik wie die Nachbarn übernehmen */
        btn.className = vorbild.className;
        btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;cursor:pointer;';
      } else {
        /* Leere topTools: eigenen Orange-Pill-Stil anwenden, damit es integriert wirkt */
        applyPillStyle(btn);
      }
      tools.appendChild(btn);
      var st1 = document.createElement('style');
      st1.textContent = '@media print{#btnZusammenfassung{display:none!important}}';
      document.head.appendChild(st1);
      return;
    }

    var header = document.querySelector('.header');
    if (!header) { document.body.appendChild(btn); return; }
    if (getComputedStyle(header).position === 'static') header.style.position = 'relative';
    applyPillStyle(btn);
    btn.style.position = 'absolute';
    btn.style.right = '14px';
    btn.style.top = '50%';
    btn.style.transform = 'translateY(-50%)';
    btn.style.zIndex = '5';
    header.appendChild(btn);

    var st = document.createElement('style');
    st.textContent = '@media print{#btnZusammenfassung{display:none!important}}';
    document.head.appendChild(st);
  }

  /* =========================================================================
     6) START
     ========================================================================= */
  function init() { applyKunde(); setzeButton(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else init();

  window.Beratung = {
    KEY: KEY, load: load, save: save, clear: clear, normalize: normalize,
    fmtDate: fmtDate, alterAus: alterAus, vollerName: vollerName,
    haushaltsName: haushaltsName, personenImHaushalt: personenImHaushalt,
    applyKunde: applyKunde, zusammenfassung: zusammenfassung,
    VERMERK_TEXT: VERMERK_TEXT, VERMERK_KURZ: VERMERK_KURZ
  };
})();
