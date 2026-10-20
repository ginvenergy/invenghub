/* =====================================================================
   IMPORTADOR — converte a planilha Stopped Turbines em ST_DADOS
   Plataforma de Engenharia · Invenergy Services Brasil
   ---------------------------------------------------------------------
   Todo o processamento ocorre no navegador. Nada é enviado a servidor.
   ===================================================================== */
var STImport = (function () {
  'use strict';

  var ABAS = {
    essentia: { fonte: 'Fonte de Dados - Essentia', hist: 'Historic' },
    auren:    { fonte: 'Fonte de Dados - Auren',    hist: 'Historic - Auren' }
  };

  /* ---------- helpers ---------- */
  function norm(s) {
    return String(s == null ? '' : s).trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function acharAba(wb, alvo) {
    var a = norm(alvo);
    for (var i = 0; i < wb.nomes.length; i++) if (norm(wb.nomes[i]) === a) return wb.nomes[i];
    for (var j = 0; j < wb.nomes.length; j++) if (norm(wb.nomes[j]).indexOf(a) >= 0) return wb.nomes[j];
    return null;
  }
  function dataBR(v) {
    if (v instanceof Date && !isNaN(v)) {
      return ('0' + v.getDate()).slice(-2) + '/' + ('0' + (v.getMonth() + 1)).slice(-2) + '/' + v.getFullYear();
    }
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var d = new Date(Math.round((v - 25569) * 86400000));
      return ('0' + d.getUTCDate()).slice(-2) + '/' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '/' + d.getUTCFullYear();
    }
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v || '').trim());
    if (m) return ('0' + m[1]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[3];
    return '';
  }
  function paraData(br) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br || '');
    return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
  }
  function txt(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function semanaISO(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dia = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dia);
    var ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { semana: Math.ceil((((t - ini) / 86400000) + 1) / 7), ano: t.getUTCFullYear() };
  }
  /* semana usada pela planilha: domingo a sábado */
  function semanaPlanilha(d) {
    var dom = new Date(d); dom.setDate(dom.getDate() - dom.getDay());
    var sab = new Date(dom); sab.setDate(sab.getDate() + 6);
    return { inicio: dataBR(dom), fim: dataBR(sab) };
  }

  /* ---------- cabeçalho por nome ---------- */
  var COLS = {
    site:    ['site'],
    wtg:     ['wtg'],
    parada:  ['data da parada'],
    retorno: ['data de retorno'],
    status:  ['status'],
    prev:    ['previsao de retorno', 'previsao retorno'],
    motivo:  ['motivo'],
    comp:    ['componente/subsistema', 'componente'],
    tipo:    ['brief description', 'tipo'],
    coment:  ['acao pendente / comentarios', 'acao pendente', 'comentarios'],
    resp:    ['responsavel pelas acoes', 'responsavel']
  };
  function mapaColunas(linhas, avisos) {
    for (var r = 0; r < Math.min(linhas.length, 12); r++) {
      var L = linhas[r] || [], idx = {}, achou = 0;
      for (var c = 0; c < L.length; c++) {
        var h = norm(L[c]);
        if (!h) continue;
        for (var k in COLS) {
          if (idx[k] != null) continue;
          for (var i = 0; i < COLS[k].length; i++) {
            if (h === COLS[k][i] || h.indexOf(COLS[k][i]) === 0) { idx[k] = c; achou++; break; }
          }
        }
      }
      if (idx.site != null && idx.wtg != null && idx.parada != null && idx.status != null) {
        ['prev','motivo','comp','tipo','coment','resp','retorno'].forEach(function (k) {
          if (idx[k] == null) avisos.push('Coluna "' + k + '" não encontrada no cabeçalho; o campo ficará vazio.');
        });
        return { idx: idx, linha: r };
      }
    }
    return null;
  }

  /* ---------- leitura de uma aba de fonte ---------- */
  function lerFonte(wb, nomeAba, hoje, avisos) {
    var linhas = wb.aba(nomeAba);
    if (!linhas) throw new Error('Aba "' + nomeAba + '" não encontrada na planilha.');
    var mc = mapaColunas(linhas, avisos);
    if (!mc) throw new Error('Não foi possível identificar o cabeçalho na aba "' + nomeAba +
                             '". Esperado encontrar as colunas Site, WTG, Data da parada e Status.');
    var ix = mc.idx, paradas = [], retornos = [];
    var limite = new Date(hoje); limite.setDate(limite.getDate() - 10); // janela de retornos

    for (var r = mc.linha + 1; r < linhas.length; r++) {
      var L = linhas[r]; if (!L) continue;
      var site = txt(L[ix.site]), wtg = txt(L[ix.wtg]);
      if (!site || !wtg) continue;

      var pBR = dataBR(L[ix.parada]);
      if (!pBR) { avisos.push('Linha ' + (r + 1) + ' de "' + nomeAba + '" ignorada: data da parada ausente ou inválida.'); continue; }
      var status = norm(L[ix.status]);
      var rBR = ix.retorno != null ? dataBR(L[ix.retorno]) : '';
      var coment = ix.coment != null ? String(L[ix.coment] == null ? '' : L[ix.coment]) : '';
      var hist = coment.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);

      var base = {
        site: site, wtg: wtg, parada: pBR,
        componente: ix.comp != null ? txt(L[ix.comp]) : '',
        tipo: ix.tipo != null ? txt(L[ix.tipo]) : '',
        motivo: ix.motivo != null ? txt(L[ix.motivo]) : '',
        responsavel: (ix.resp != null ? txt(L[ix.resp]) : '') || 'Invenergy'
      };

      if (status.indexOf('parada') === 0) {
        base.previsao = ix.prev != null ? dataBR(L[ix.prev]) : '';
        base.historico = hist;
        paradas.push(base);
      } else if (rBR) {
        var dp = paraData(pBR), dr = paraData(rBR);
        if (dp && dr && dr >= limite && Math.floor((dr - dp) / 86400000) >= 7) {
          retornos.push({
            site: site, wtg: wtg, parada: pBR, retorno: rBR,
            componente: base.componente, motivo: base.motivo,
            obs: hist.length ? hist[hist.length - 1] : ''
          });
        }
      }
    }
    paradas.sort(function (a, b) { return paraData(b.parada) - paraData(a.parada); });
    return { paradas: paradas, retornos: retornos };
  }

  /* ---------- leitura de uma aba Historic ---------- */
  function lerHistorico(wb, nomeAba, avisos) {
    var linhas = wb.aba(nomeAba);
    if (!linhas) { avisos.push('Aba "' + nomeAba + '" não encontrada; a série histórica não foi atualizada.'); return null; }
    var cab = null;
    for (var r = 0; r < Math.min(linhas.length, 8); r++) {
      var L = linhas[r] || [], idx = {};
      for (var c = 0; c < L.length; c++) {
        var h = norm(L[c]);
        if (h === 'year') idx.ano = c;
        else if (h === 'week') idx.sem = c;
        else if (h === 'total') idx.tot = c;
      }
      if (idx.ano != null && idx.sem != null && idx.tot != null) { cab = { idx: idx, linha: r }; break; }
    }
    if (!cab) { avisos.push('Cabeçalho não reconhecido em "' + nomeAba + '" (esperado Year, Week e Total).'); return null; }

    var out = {};
    for (var i = cab.linha + 1; i < linhas.length; i++) {
      var Ln = linhas[i]; if (!Ln) continue;
      var ano = parseInt(Ln[cab.idx.ano], 10), sem = parseInt(Ln[cab.idx.sem], 10), tot = Ln[cab.idx.tot];
      if (!ano || !sem || tot == null || tot === '') continue;
      var v = typeof tot === 'number' ? tot : parseInt(tot, 10);
      if (isNaN(v)) continue;
      if (!out[ano]) out[ano] = {};
      out[ano][sem] = v;
    }
    return out;
  }

  /* ---------- corta semanas futuras ainda sem dado ---------- */
  function limpaFuturo(serie, ano, semAtual) {
    if (!serie || !serie[ano]) return serie;
    var s = serie[ano], ult = 0, w;
    for (w in s) if (+w <= semAtual && s[w] > 0) ult = Math.max(ult, +w);
    for (w in s) if (+w > Math.max(ult, semAtual)) delete s[w];
    return serie;
  }

  /* ---------- principal ---------- */
  function processar(arrayBuffer, frotaAtual) {
    var avisos = [], wb;
    try { wb = XLSXLite.read(arrayBuffer); }
    catch (e) { throw new Error('Não foi possível ler o arquivo: ' + e.message); }

    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var sw = semanaISO(hoje), per = semanaPlanilha(hoje);

    var res = { paradas: {}, retornos: {}, historico: {} };
    var totalLinhas = 0;

    for (var cli in ABAS) {
      var nf = acharAba(wb, ABAS[cli].fonte);
      if (!nf) throw new Error('A aba "' + ABAS[cli].fonte + '" não foi encontrada. ' +
                               'Abas disponíveis: ' + wb.nomes.join(', '));
      var f = lerFonte(wb, nf, hoje, avisos);
      res.paradas[cli] = f.paradas;
      res.retornos[cli] = f.retornos;
      totalLinhas += f.paradas.length + f.retornos.length;

      var nh = acharAba(wb, ABAS[cli].hist);
      var h = nh ? lerHistorico(wb, nh, avisos) : null;
      res.historico[cli] = h || {};
    }

    /* fecha a semana corrente com a contagem real, se ainda não houver valor */
    for (var c2 in ABAS) {
      var cont = res.paradas[c2].filter(function (p) {
        var d = paraData(p.parada);
        return d && Math.floor((hoje - d) / 86400000) >= 7;
      }).length;
      if (!res.historico[c2][sw.ano]) res.historico[c2][sw.ano] = {};
      var atual = res.historico[c2][sw.ano][sw.semana];
      if (atual == null || atual === 0) res.historico[c2][sw.ano][sw.semana] = cont;
      else if (atual !== cont) {
        avisos.push('Em ' + (c2 === 'essentia' ? 'Essentia' : 'Auren') + ', a aba Historic informa ' +
          atual + ' para a semana ' + sw.semana + ', mas a fonte de dados tem ' + cont +
          ' máquina(s) com 7 dias ou mais. O valor da aba Historic foi mantido.');
      }
      limpaFuturo(res.historico[c2], sw.ano, sw.semana);
    }

    var dados = {
      semana: {
        numero: sw.semana, ano: sw.ano,
        inicio: per.inicio, fim: per.fim,
        atualizado: dataBR(hoje),
        responsavel: 'Importado da planilha'
      },
      frota: frotaAtual,
      paradas: res.paradas,
      retornos: res.retornos,
      historico: res.historico
    };

    return {
      dados: dados,
      avisos: avisos,
      resumo: {
        abas: wb.nomes.length,
        essentia: res.paradas.essentia.length,
        auren: res.paradas.auren.length,
        retornos: res.retornos.essentia.length + res.retornos.auren.length,
        semana: sw.semana
      }
    };
  }

  /* ---------- gera o arquivo .js para commit ---------- */
  function gerarArquivo(d) {
    function s(v) { return '"' + String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
    function bloco(p, ind) {
      var t = ind, o = t + '{\n';
      o += t + '  site: ' + s(p.site) + ',\n';
      o += t + '  wtg: ' + s(p.wtg) + ',\n';
      o += t + '  parada: ' + s(p.parada) + ',\n';
      if ('previsao' in p) o += t + '  previsao: ' + s(p.previsao) + ',\n';
      if ('retorno' in p)  o += t + '  retorno: ' + s(p.retorno) + ',\n';
      o += t + '  componente: ' + s(p.componente) + ',\n';
      if (p.tipo != null) o += t + '  tipo: ' + s(p.tipo) + ',\n';
      o += t + '  motivo: ' + s(p.motivo) + ',\n';
      if (p.responsavel) o += t + '  responsavel: ' + s(p.responsavel) + ',\n';
      if (p.obs != null) o += t + '  obs: ' + s(p.obs) + ',\n';
      if (p.historico) {
        o += t + '  historico: ' + (p.historico.length
          ? '[\n' + p.historico.map(function (h) { return t + '    ' + s(h); }).join(',\n') + '\n' + t + '  ]'
          : '[]') + '\n';
      } else o = o.replace(/,\n$/, '\n');
      return o + t + '}';
    }
    function lista(arr, ind) { return arr.map(function (p) { return bloco(p, ind); }).join(',\n'); }
    function serie(o) {
      var ks = Object.keys(o).map(Number).sort(function (a, b) { return a - b; });
      var it = ks.map(function (k) { return k + ':' + o[k]; }), out = [];
      for (var i = 0; i < it.length; i += 13) out.push('      ' + it.slice(i, i + 13).join(', '));
      return '{\n' + out.join(',\n') + '\n    }';
    }
    function hist(h) {
      return Object.keys(h).map(Number).sort().map(function (a) {
        return '      ' + a + ': ' + serie(h[a]).replace(/\n    \}/, '\n      }').replace(/\n      /g, '\n        ');
      }).join(',\n');
    }
    var S = d.semana;
    return '/* =====================================================================\n' +
      '   STOPPED TURBINES — BASE DE DADOS\n' +
      '   Gerado automaticamente pelo importador da Plataforma de Engenharia\n' +
      '   Semana ' + S.numero + '/' + S.ano + ' · ' + S.inicio + ' a ' + S.fim + '\n' +
      '   Gerado em ' + S.atualizado + '\n' +
      '   ---------------------------------------------------------------------\n' +
      '   Não edite à mão: reimporte a planilha para atualizar.\n' +
      '   ===================================================================== */\n\n' +
      'const ST_DADOS = {\n\n' +
      '  semana: {\n' +
      '    numero: ' + S.numero + ',\n    ano: ' + S.ano + ',\n' +
      '    inicio: ' + s(S.inicio) + ',\n    fim: ' + s(S.fim) + ',\n' +
      '    atualizado: ' + s(S.atualizado) + ',\n    responsavel: ' + s(S.responsavel) + '\n  },\n\n' +
      '  frota: ' + JSON.stringify(d.frota, null, 2).replace(/\n/g, '\n  ') + ',\n\n' +
      '  paradas: {\n    essentia: [\n' + lista(d.paradas.essentia, '      ') + '\n    ],\n' +
      '    auren: [\n' + lista(d.paradas.auren, '      ') + '\n    ]\n  },\n\n' +
      '  retornos: {\n    essentia: [\n' + lista(d.retornos.essentia, '      ') + '\n    ],\n' +
      '    auren: [\n' + lista(d.retornos.auren, '      ') + '\n    ]\n  },\n\n' +
      '  historico: {\n    essentia: {\n' + hist(d.historico.essentia) + '\n    },\n' +
      '    auren: {\n' + hist(d.historico.auren) + '\n    }\n  }\n};\n';
  }

  return { processar: processar, gerarArquivo: gerarArquivo };
})();
