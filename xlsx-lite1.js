/* =====================================================================
   XLSX-LITE — leitor mínimo de arquivos .xlsx, 100% local
   Plataforma de Engenharia · Invenergy Services Brasil
   ---------------------------------------------------------------------
   Sem dependência externa, sem CDN, sem envio de dados.
   Implementa: INFLATE (RFC1951) + leitura de ZIP + parse de SpreadsheetML.
   Uso:  XLSXLite.read(arrayBuffer) -> { nomes:[], aba(nome) -> [[...]] }
   ===================================================================== */
var XLSXLite = (function () {
  'use strict';

  /* ---------------- INFLATE (raw deflate, RFC 1951) ---------------- */
  function Bits(buf, pos) { this.b = buf; this.p = pos; this.bit = 0; this.cur = 0; }
  Bits.prototype.get = function (n) {
    var v = 0, i = 0;
    while (i < n) {
      if (this.bit === 0) { this.cur = this.b[this.p++]; this.bit = 8; }
      var take = Math.min(n - i, this.bit);
      v |= ((this.cur & ((1 << take) - 1)) << i);
      this.cur >>= take; this.bit -= take; i += take;
    }
    return v >>> 0;
  };
  Bits.prototype.align = function () { this.bit = 0; };

  /* implementação canônica (mais segura) */
  function buildTree(lens) {
    var MAXBITS = 15, i;
    var count = new Int32Array(MAXBITS + 1);
    for (i = 0; i < lens.length; i++) count[lens[i]]++;
    count[0] = 0;
    var offs = new Int32Array(MAXBITS + 2);
    for (i = 1; i <= MAXBITS; i++) offs[i + 1] = offs[i] + count[i];
    var symbol = new Int32Array(lens.length);
    for (i = 0; i < lens.length; i++) if (lens[i]) symbol[offs[lens[i]]++] = i;
    return { count: count, symbol: symbol };
  }
  function decodeSym(br, t) {
    var code = 0, first = 0, index = 0, len, count;
    for (len = 1; len <= 15; len++) {
      code |= br.get(1);
      count = t.count[len];
      if (code - first < count) return t.symbol[index + (code - first)];
      index += count; first += count; first <<= 1; code <<= 1;
    }
    throw new Error('Fluxo comprimido corrompido');
  }

  var LBASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  var LEXT  = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  var DBASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  var DEXT  = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  var ORD   = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

  function inflateRaw(buf, start, expected) {
    var br = new Bits(buf, start);
    var out = new Uint8Array(expected > 0 ? expected : 65536), o = 0;
    function push(b) {
      if (o >= out.length) { var t = new Uint8Array(out.length * 2); t.set(out); out = t; }
      out[o++] = b;
    }
    var fixL = null, fixD = null;
    for (;;) {
      var last = br.get(1), type = br.get(2);
      if (type === 0) {
        br.align();
        var len = buf[br.p] | (buf[br.p + 1] << 8); br.p += 4;
        for (var i = 0; i < len; i++) push(buf[br.p++]);
      } else {
        var lt, dt;
        if (type === 1) {
          if (!fixL) {
            var l = new Uint8Array(288), k;
            for (k = 0; k < 144; k++) l[k] = 8;
            for (; k < 256; k++) l[k] = 9;
            for (; k < 280; k++) l[k] = 7;
            for (; k < 288; k++) l[k] = 8;
            fixL = buildTree(l);
            var d = new Uint8Array(30); for (k = 0; k < 30; k++) d[k] = 5;
            fixD = buildTree(d);
          }
          lt = fixL; dt = fixD;
        } else if (type === 2) {
          var nlen = br.get(5) + 257, ndist = br.get(5) + 1, ncode = br.get(4) + 4;
          var cl = new Uint8Array(19), j;
          for (j = 0; j < ncode; j++) cl[ORD[j]] = br.get(3);
          var clt = buildTree(cl);
          var lens = new Uint8Array(nlen + ndist), n = 0;
          while (n < nlen + ndist) {
            var s = decodeSym(br, clt), rep, val;
            if (s < 16) { lens[n++] = s; }
            else if (s === 16) { val = lens[n - 1]; rep = 3 + br.get(2); while (rep--) lens[n++] = val; }
            else if (s === 17) { rep = 3 + br.get(3); while (rep--) lens[n++] = 0; }
            else { rep = 11 + br.get(7); while (rep--) lens[n++] = 0; }
          }
          lt = buildTree(lens.subarray(0, nlen));
          dt = buildTree(lens.subarray(nlen));
        } else throw new Error('Bloco deflate inválido');

        for (;;) {
          var sym = decodeSym(br, lt);
          if (sym === 256) break;
          if (sym < 256) push(sym);
          else {
            sym -= 257;
            var length = LBASE[sym] + br.get(LEXT[sym]);
            var ds = decodeSym(br, dt);
            var dist = DBASE[ds] + br.get(DEXT[ds]);
            for (var c = 0; c < length; c++) push(out[o - dist]);
          }
        }
      }
      if (last) break;
    }
    return out.subarray(0, o);
  }

  /* ---------------- ZIP ---------------- */
  function lerZip(ab) {
    var b = new Uint8Array(ab), dv = new DataView(ab), i;
    var eocd = -1;
    for (i = b.length - 22; i >= 0 && i > b.length - 66000; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Arquivo não é um .xlsx válido (assinatura ZIP não encontrada).');
    var nEnt = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
    var arq = {}, p = cdOff;
    for (i = 0; i < nEnt; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var metodo = dv.getUint16(p + 10, true);
      var tamComp = dv.getUint32(p + 20, true);
      var tamOrig = dv.getUint32(p + 24, true);
      var nLen = dv.getUint16(p + 28, true);
      var eLen = dv.getUint16(p + 30, true);
      var cLen = dv.getUint16(p + 32, true);
      var lOff = dv.getUint32(p + 42, true);
      var nome = '';
      for (var k = 0; k < nLen; k++) nome += String.fromCharCode(b[p + 46 + k]);
      arq[nome] = { metodo: metodo, off: lOff, comp: tamComp, orig: tamOrig };
      p += 46 + nLen + eLen + cLen;
    }
    return {
      tem: function (n) { return !!arq[n]; },
      lista: function () { return Object.keys(arq); },
      texto: function (nome) {
        var e = arq[nome];
        if (!e) return null;
        var nl = dv.getUint16(e.off + 26, true), el = dv.getUint16(e.off + 28, true);
        var ini = e.off + 30 + nl + el;
        var dados = e.metodo === 0
          ? b.subarray(ini, ini + e.orig)
          : inflateRaw(b, ini, e.orig);
        if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(dados);
        var s = ''; for (var i2 = 0; i2 < dados.length; i2++) s += String.fromCharCode(dados[i2]);
        return decodeURIComponent(escape(s));
      }
    };
  }

  /* ---------------- SpreadsheetML ---------------- */
  function desescapa(s) {
    return s.replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); })
            .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&');
  }
  function colNum(ref) {
    var m = /^([A-Z]+)/.exec(ref); if (!m) return 0;
    var n = 0, s = m[1];
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }
  function serialParaData(n) {
    var ms = Math.round((n - 25569) * 86400000);
    var d = new Date(ms);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  function read(ab) {
    var z = lerZip(ab);

    /* strings compartilhadas */
    var sst = [];
    if (z.tem('xl/sharedStrings.xml')) {
      var xs = z.texto('xl/sharedStrings.xml');
      var re = /<si\b[^>]*>([\s\S]*?)<\/si>/g, m;
      while ((m = re.exec(xs))) {
        var txt = '', rt = /<t\b[^>]*>([\s\S]*?)<\/t>/g, t;
        while ((t = rt.exec(m[1]))) txt += t[1];
        sst.push(desescapa(txt));
      }
    }

    /* formatos: descobre quais xf são data */
    var ehData = {};
    if (z.tem('xl/styles.xml')) {
      var st = z.texto('xl/styles.xml');
      var fmt = {};
      var rf = /<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g, f;
      while ((f = rf.exec(st))) fmt[f[1]] = desescapa(f[2]);
      var mc = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(st);
      if (mc) {
        var rx = /<xf\b[^>]*numFmtId="(\d+)"[^>]*>/g, x, i = 0;
        while ((x = rx.exec(mc[1]))) {
          var id = +x[1], code = fmt[id] || '';
          var dt = (id >= 14 && id <= 22) || (id >= 45 && id <= 47) ||
                   /[dmy]/i.test(code.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '')) &&
                   /d|y/i.test(code);
          ehData[i++] = !!dt;
        }
      }
    }

    /* mapa de abas */
    var rels = {};
    if (z.tem('xl/_rels/workbook.xml.rels')) {
      var xr = z.texto('xl/_rels/workbook.xml.rels');
      var rr = /<Relationship\b([^>]*)\/?>/g, r;
      while ((r = rr.exec(xr))) {
        var at = r[1];
        var id = (/Id="([^"]+)"/.exec(at) || [])[1];
        var tg = (/Target="([^"]+)"/.exec(at) || [])[1];
        if (id && tg) rels[id] = tg.replace(/^\/?xl\//, '').replace(/^\//, '');
      }
    }
    var abas = [], nomes = [];
    var wb = z.texto('xl/workbook.xml') || '';
    var rs = /<sheet\b([^>]*)\/?>/g, s2;
    while ((s2 = rs.exec(wb))) {
      var sa = s2[1];
      var nm = (/name="([^"]*)"/.exec(sa) || [])[1];
      var rid = (/r:id="([^"]*)"/.exec(sa) || /relationships:id="([^"]*)"/.exec(sa) || [])[1];
      if (!nm || !rid || !rels[rid]) continue;
      var nome = desescapa(nm);
      nomes.push(nome);
      abas.push({ nome: nome, alvo: rels[rid] });
    }
    if (!abas.length) {
      z.lista().forEach(function (n) {
        var mm = /^xl\/worksheets\/(sheet\d+)\.xml$/.exec(n);
        if (mm) { nomes.push(mm[1]); abas.push({ nome: mm[1], alvo: 'worksheets/' + mm[1] + '.xml' }); }
      });
    }

    function aba(nomeAba) {
      var alvo = null;
      for (var i = 0; i < abas.length; i++) if (abas[i].nome === nomeAba) alvo = abas[i].alvo;
      if (!alvo) return null;
      var caminho = alvo.indexOf('xl/') === 0 ? alvo : 'xl/' + alvo;
      if (!z.tem(caminho)) return null;
      var xml = z.texto(caminho);

      var linhas = [];
      var rr2 = /<row\b([^>]*)>([\s\S]*?)<\/row>/g, rw;
      while ((rw = rr2.exec(xml))) {
        var ri = /r="(\d+)"/.exec(rw[1]);
        var idx = ri ? (+ri[1] - 1) : linhas.length;
        var cels = [];
        var rc = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, c;
        while ((c = rc.exec(rw[2]))) {
          var at = c[1], corpo = c[2] || '';
          var mr = /r="([A-Z]+\d+)"/.exec(at);
          var ci = mr ? colNum(mr[1]) : cels.length;
          var tp = (/t="([^"]+)"/.exec(at) || [])[1] || 'n';
          var sIdx = (/s="(\d+)"/.exec(at) || [])[1];
          var val = null;
          if (tp === 'inlineStr') {
            var it = '', ri2 = /<t\b[^>]*>([\s\S]*?)<\/t>/g, tt;
            while ((tt = ri2.exec(corpo))) it += tt[1];
            val = desescapa(it);
          } else {
            var mv = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(corpo);
            if (mv) {
              var raw = mv[1];
              if (tp === 's') val = sst[+raw] != null ? sst[+raw] : '';
              else if (tp === 'str' || tp === 'e') val = desescapa(raw);
              else if (tp === 'b') val = raw === '1';
              else {
                var num = parseFloat(raw);
                val = (sIdx != null && ehData[+sIdx] && num > 20000 && num < 80000)
                  ? serialParaData(num) : num;
              }
            }
          }
          cels[ci] = val == null ? null : val;
        }
        for (var q = 0; q < cels.length; q++) if (cels[q] === undefined) cels[q] = null;
        linhas[idx] = cels;
      }
      for (var w = 0; w < linhas.length; w++) if (!linhas[w]) linhas[w] = [];
      return linhas;
    }

    return { nomes: nomes, aba: aba };
  }

  return { read: read };
})();
