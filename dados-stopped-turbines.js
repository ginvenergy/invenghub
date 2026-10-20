/* =====================================================================
   STOPPED TURBINES — BASE DE DADOS
   Gerado automaticamente pelo importador da Plataforma de Engenharia
   Semana 39/2026 · 20/09/2026 a 26/09/2026
   Gerado em 25/09/2026
   ---------------------------------------------------------------------
   Não edite à mão: reimporte a planilha para atualizar.
   ===================================================================== */

const ST_DADOS = {

  semana: {
    numero: 39,
    ano: 2026,
    inicio: "20/09/2026",
    fim: "26/09/2026",
    atualizado: "25/09/2026",
    responsavel: "Importado da planilha"
  },

  frota: {
    "essentia": {
      "Chapada I": 115,
      "Chapada II": 100,
      "Chapada III": 32,
      "Asa Branca": 100
    },
    "auren": {
      "Caetés": 107,
      "Alto Sertão 2": 130
    }
  },

  paradas: {
    essentia: [
      {
        site: "Asa Branca",
        wtg: "AB08-19",
        parada: "22/09/2026",
        previsao: "",
        componente: "Pitch Bearing",
        tipo: "UPTOWER REPAIR",
        motivo: "Reparo da cremalheira do pitch",
        responsavel: "Invenergy",
        historico: [
          "24/09: Reparo pela Now Solutions."
        ]
      },
      {
        site: "Chapada II",
        wtg: "JOA04-07",
        parada: "14/09/2026",
        previsao: "",
        componente: "Gearbox",
        tipo: "MCE",
        motivo: "Falha de gearbox",
        responsavel: "Invenergy",
        historico: [
          "17/09: Falha do estágio planetário."
        ]
      },
      {
        site: "Chapada I",
        wtg: "JOA16-15",
        parada: "11/09/2026",
        previsao: "24/09/2026",
        componente: "Gerador",
        tipo: "MCE",
        motivo: "Falha do gerador",
        responsavel: "Invenergy",
        historico: [
          "17/09: Falha do gerador."
        ]
      },
      {
        site: "Chapada III",
        wtg: "AUG03-06",
        parada: "09/09/2026",
        previsao: "",
        componente: "Gearbox",
        tipo: "MCE",
        motivo: "Troca de gearbox",
        responsavel: "Invenergy",
        historico: [
          "10/09: Troca da gearbox em andamento."
        ]
      },
      {
        site: "Chapada I",
        wtg: "JOA12-03",
        parada: "09/07/2026",
        previsao: "",
        componente: "Blade",
        tipo: "MCE",
        motivo: "Colapso de Blade",
        responsavel: "Invenergy",
        historico: [
          "10/07: Investigação.",
          "24/09: Aguardando descida das 2 blades."
        ]
      }
    ],
    auren: [
      {
        site: "Caetés",
        wtg: "EBR05-13",
        parada: "03/09/2026",
        previsao: "02/10/2026",
        componente: "Gearbox",
        tipo: "MCE",
        motivo: "Colapso da gearbox",
        responsavel: "Auren",
        historico: [
          "17/09: Auren mobilizando."
        ]
      },
      {
        site: "Caetés",
        wtg: "EBR06-08",
        parada: "24/07/2026",
        previsao: "",
        componente: "Pitch Bearing",
        tipo: "MCE",
        motivo: "Falha no Pitch Bearing",
        responsavel: "Auren",
        historico: [
          "30/07: Danos internos."
        ]
      },
      {
        site: "Caetés",
        wtg: "EBR07-12",
        parada: "16/06/2026",
        previsao: "",
        componente: "Blade",
        tipo: "UPTOWER REPAIR",
        motivo: "Reparo de Blade",
        responsavel: "Auren",
        historico: [
          "16/07: Responsabilidade Auren.",
          "10/09: Auren finalizando."
        ]
      }
    ]
  },

  retornos: {
    essentia: [
      {
        site: "Asa Branca",
        wtg: "AB07-20",
        parada: "08/09/2026",
        retorno: "20/09/2026",
        componente: "Pitch Bearing",
        motivo: "Reparo cremalheira pitch",
        obs: "20/09: Concluído."
      },
      {
        site: "Chapada II",
        wtg: "JOA01-02",
        parada: "08/09/2026",
        retorno: "22/09/2026",
        componente: "Gerador",
        motivo: "Falha do Wye Ring",
        obs: "22/09: Concluído."
      }
    ],
    auren: [
      {
        site: "Alto Sertão 2",
        wtg: "MAR-12",
        parada: "26/08/2026",
        retorno: "16/09/2026",
        componente: "Gerador",
        motivo: "Falha do Wye Ring",
        obs: "16/09: Concluído."
      }
    ]
  },

  historico: {
    essentia: {
      2025: {
        1:12, 2:11, 3:13, 4:15, 5:15, 6:13, 7:18, 8:15, 9:14, 10:13, 11:12, 12:14, 13:13,
        14:12, 15:13, 16:14, 17:16, 18:14, 19:14, 20:9, 21:11, 22:12, 23:11, 24:11, 25:17, 26:18,
        27:18, 28:16, 29:12, 30:10, 31:7, 32:8, 33:7, 34:6, 35:4, 36:4, 37:9, 38:9, 39:7,
        40:9, 41:10, 42:10, 43:9, 44:10, 45:13, 46:10, 47:11, 48:10, 49:11, 50:5, 51:3, 52:3
        },
      2026: {
        1:2, 2:3, 3:6, 4:6, 5:7, 6:6, 7:5, 8:6, 9:6, 10:5, 11:4, 12:5, 13:2,
        14:4, 15:5, 16:2, 17:3, 18:4, 19:4, 20:3, 21:6, 22:2, 23:4, 24:3, 25:4, 26:3,
        27:2, 28:2, 29:4, 30:4, 31:3, 32:6, 33:6, 34:3, 35:2, 36:3, 37:2, 38:4, 39:4
        }
    },
    auren: {
      2026: {
        5:0, 6:0, 7:0, 8:0, 9:0, 10:0, 11:0, 12:0, 13:0, 14:0, 15:0, 16:0, 17:0,
        18:0, 19:0, 20:0, 21:0, 22:0, 23:0, 24:0, 25:0, 26:0, 27:0, 28:0, 29:3, 30:5,
        31:5, 32:4, 33:4, 34:6, 35:6, 36:7, 37:3, 38:3, 39:3
        }
    }
  }
};
