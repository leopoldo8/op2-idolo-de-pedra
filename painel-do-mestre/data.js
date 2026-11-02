window.DATA = {
  doorCode: "160322",
  survivorsNeeded: 2,
  players: 3,

  tvStart: {
    alan: { x: 50, y: 27 },
    victor: { x: 56, y: 27 },
    eloisa: { x: 34, y: 44 },
    edgar: { x: 27, y: 36 },
    gustavo: { x: 81, y: 14 }
  },

  characters: [
    {
      id: "alan", name: "Alan", profile: "Executor, Cientista", pvMax: 10, pvStart: 9, pdMax: 16,
      abilities: "Foco Mental, Ímpeto", crime: "d6", crimeTries: 2,
      start: "Trancado no Depósito B com o Victor. Ferido na nuca (começa com 9 PV).",
      secret: "Matou o Gustavo. Cúmplice da Eloísa. Roupa grande com \"G.\" bordado (é do Gustavo). Celular com 1% mostra o Handout 01 e apaga. Reconhece a própria letra nas anotações (Percepção DT 8). Reconhece o Gustavo no freezer (Intuição DT 4).",
      skills: { Tec: "d4+d8", Int: "d4+d8", Pesq: "d6+d8", Perc: "d8+d8", Atl: "d4+d6", Acro: "d4+d6", Disc: "d6+d8" }
    },
    {
      id: "victor", name: "Victor", profile: "Vigilante, Professor", pvMax: 14, pvStart: 14, pdMax: 14,
      abilities: "Mentoria, Prontidão", crime: "d4", crimeTries: 1,
      start: "Trancado no Depósito B com o Alan.",
      secret: "Fez o ritual que apagou a memória de todos. Foi avisado pelo Gustavo. Giz branco, papéis que se desfazem, brincos de ouro da avó. Dedos sujos de giz, rabiscos borrados no chão do Depósito B. Reconhece o Gustavo no freezer.",
      skills: { Tec: "d4+d6", Int: "d4+d8", Pesq: "d8+d6", Perc: "d6+d6", Atl: "d6+d8", Acro: "d4+d8", Disc: "d6+d8" }
    },
    {
      id: "eloisa", name: "Eloísa", profile: "Analista, Artista", pvMax: 12, pvStart: 12, pdMax: 14,
      abilities: "Avaliação, Foco Emocional", crime: "d6", crimeTries: 2,
      start: "Livre, ao lado do altar. É a melhor em Tecnologia do grupo (d6).",
      secret: "Cúmplice do Alan. Drogou as bebidas com o remédio dela. Mesa de 3: foi ela quem matou o Edgar com a faca de churrasco, porque ele parecia prestes a acordar (ela não lembra). Roupa de academia (estranha pra ela). Fone bluetooth: \"Mensagem de Alan: 'Venha imediatamente', enviada há 4 horas\".",
      skills: { Tec: "d6+d8", Int: "d8+d6", Pesq: "d6+d8", Perc: "d6+d8", Atl: "d4+d8", Acro: "d6+d8", Disc: "d6+d6" }
    },
    {
      id: "edgar", name: "Edgar", tvName: "Homem no altar", startStatus: "morto", profile: "Executor, Operário", pvMax: 18, pvStart: 18, pdMax: 10,
      abilities: "Esforço e Suor, Ímpeto", crime: "d6", crimeTries: 2,
      start: "Mesa de 3: não é jogável. Já está morto, acorrentado no altar, com a garganta cortada e a faca de churrasco ao lado.",
      secret: "A Eloísa o matou antes de o Alan terminar de arrastar o Victor, porque ele parecia prestes a acordar. Era o primeiro a ser sacrificado.",
      skills: { Tec: "d4+d6", Int: "d4+d6", Pesq: "d4+d6", Perc: "d6+d6", Atl: "d8+d10", Acro: "d4+d10", Disc: "d4+d6" }
    }
  ],

  skillNames: { Tec: "Tecnologia", Int: "Intuição", Pesq: "Pesquisar", Perc: "Percepção", Atl: "Atletismo", Acro: "Acrobacia", Disc: "Disciplina" },

  roundReminders: {
    1: [
      "Eloísa livre ao lado do altar. Alan e Victor trancados no Depósito B. No altar, o corpo do Edgar, que ninguém reconhece.",
      "Mesa de 3, leia ao fim da abertura (p. 33): \"Por fim, todos vocês olham com atenção para o homem acorrentado sobre o balcão. A camisa dele está ensopada de sangue e ele parece não estar respirando.\"",
      "Música: \"O Porão\". Cada jogador faz uma ação por rodada."
    ],
    2: [
      "No fim desta rodada: se ninguém examinou o próprio corpo, todos notam o símbolo \"tatuado\" no pulso."
    ]
  },

  curse: [
    { round: 0, text: "Todos fazem Disciplina DT 7. Passou: -2 PD. Falhou: -4 PD e fica a próxima rodada sem agir, chorando de pavor." },
    { round: 4, text: "No fim da rodada, cada personagem perde 1 PD, a menos que tenha causado dano em outro personagem vivo.", loss: { pv: 0, pd: 1 } },
    { round: 7, text: "Igual, mas perde 2 PD.", loss: { pv: 0, pd: 2 } },
    { round: 10, text: "Igual, mas perde 2 PV e 3 PD.", loss: { pv: 2, pd: 3 } },
    { round: 13, text: "Os cadáveres convulsionam (o do Gustavo e o de quem já morreu). Nada acontece, mas é a última rodada pra escapar." },
    { round: 14, text: "Os cadáveres se erguem e, na mesma rodada, cada um absorve e mata o personagem mais próximo. Se ainda houver mais de dois vivos, cada cadáver mata mais um na rodada seguinte." }
  ],

  steps: [
    { id: "celas", title: "Sair das celas", text: "Eloísa abre o Depósito B (Alan e Victor) ou o Depósito A (onde estão as chaves 1)." },
    { id: "painel", title: "Painel elétrico (Depósito A)", text: "Hack técnico pra entender. Disjuntor \"Porão\" (ligado) e \"Segredo\" (desligado). O certo é deixar os dois ligados." },
    { id: "sala", title: "Entrar na sala secreta", text: "Estante: os 4 livros certos e depois Sustentar. Ou duto de ventilação: Alcançar e depois Arrombar." },
    { id: "roupas", title: "Armário de roupas (sala secreta)", text: "Roupas ensanguentadas do Alan, RG do Alan (Handout 11) e molho de chaves 2 (abre o freezer e o armário de metal)." },
    { id: "freezer", title: "Freezer", text: "Corpo do Gustavo (Handout 13). Disciplina DT 10, quem falha perde 1 PD. Foto (Handout 14): Laura nasceu em 02/09/2015. Pulseira de prata \"Olívia - 10/08\": casaram em 10/08/1997." },
    { id: "armario", title: "Armário de metal", text: "Ídolo de Pedra, jaqueta com o RG do Gustavo (Handout 03: Gustavo Alves de Campos, 07/06/1978) e anotações (Handout 04). Mesa de 3: a faca não está aqui, está no altar, ao lado do Edgar. Abrir ativa a maldição." },
    { id: "celular", title: "Celular do Gustavo", text: "Na mesa embaixo do duto. Hack social, 4 respostas certas. Depois: grupo \"Reunião\" (05A), conversas com Alan (05B) e Victor (05C), app TRANCATRON." },
    { id: "computador", title: "Computador (sala secreta)", text: "Precisa do disjuntor \"Segredo\" e do celular desbloqueado. Hack técnico. E-mails 12A, 12B, 12C: o 12A, de 12/03/2022, marca o encontro \"daqui a 4 dias\" = 16/03/2022." },
    { id: "porta", title: "Porta de saída", text: "Senha 160322. Três erros bloqueiam o teclado por 2 rodadas. Quando o painel religa, a tela pisca \"DD/MM/AA\"." }
  ],

  crimeTries: "Tentativas de destrancar por rodada, pela perícia Crime: d4 = 1, d6 = 2, d8 = 3, d10 = 4, d12 = 5.",

  locks: [
    { id: "depA", name: "Porta do Depósito A", dice: 3, sides: 6, maxTries: 3, breakDT: 10, breakPA: 10, key: "Chaves 1" },
    { id: "depB", name: "Porta do Depósito B", dice: 3, sides: 6, maxTries: 3, breakDT: 7, breakPA: 10, key: "Chaves 1" },
    { id: "armario", name: "Armário de metal", dice: 5, sides: 6, maxTries: 3, breakDT: 7, breakPA: 10, key: "Chaves 2", warn: "Abrir ativa a maldição. Arrombar quebra o Ídolo e as anotações passam de DT 6 pra DT 10. Intuição DT 6 avisa: \"Tem certeza de que quer arrombar?\"" },
    { id: "freezer", name: "Freezer", dice: 4, sides: 6, maxTries: 3, breakDT: 7, breakPA: 12, key: "Chaves 2", note: "Tentativas e arrombamento são sugestões (o livro é ambíguo)." },
    { id: "duto", name: "Grade do duto", dice: 0, breakDT: 7, breakPA: 10, note: "Antes, Alcançar DT 7. O duto só é largo até a sala secreta." }
  ],

  hack: {
    painel: {
      label: "Painel elétrico",
      question: "Em qual letra termina o fio do disjuntor com a fita vermelha?",
      bands: [
        { id: "10", label: "10 ou mais", seconds: 10, images: ["hack-painel-3-fios", "hack-painel-3-fios-v2"], answers: ["A", "C"] },
        { id: "7", label: "7 a 9", seconds: 10, images: ["hack-painel-4-fios", "hack-painel-4-fios-v2"], answers: ["D", "D"] },
        { id: "5", label: "5 a 6", seconds: 10, images: ["hack-painel-5-fios", "hack-painel-5-fios-v2"], answers: ["D", "A"] },
        { id: "1", label: "1 a 4", seconds: 10, images: ["hack-painel-6-fios", "hack-painel-6-fios-v2"], answers: ["E", "F"] }
      ],
      success: "Pesquisar DT 6: dois disjuntores etiquetados, \"Porão\" (ligado) e \"Segredo\" (desligado)."
    },
    computador: {
      label: "Computador",
      question: "Aponte a única pasta com nome que dá pra ler.",
      bands: [
        { id: "10", label: "10 ou mais", seconds: 30 },
        { id: "7", label: "7 a 9", seconds: 22 },
        { id: "5", label: "5 a 6", seconds: 15 },
        { id: "1", label: "1 a 4", seconds: 15 }
      ],
      images: ["hack-computador", "hack-computador-v2"],
      answers: ["Documentos importantes: 3ª coluna, 7ª linha", "Documentos importantes: 9ª coluna, 2ª linha"],
      success: "Laudos médicos (o mais recente: \"Sem evidência de doença\"). A caixa de e-mail pede verificação de dois fatores no celular do Gustavo."
    }
  },

  social: {
    needed: 4,
    hint: "Tecnologia DT 4 no celular mostra o lembrete de senha \"Prata = 25\".",
    pacing: "Nome completo e aniversário só estão no RG, dentro do armário de metal com o Ídolo. Perguntar esses dois obriga o grupo a abrir o armário e a maldição começa antes da fuga. Só datas e nomes da família: dá pra resolver com o que está no freezer.",
    questions: [
      { q: "Nome completo do Gustavo", a: "Gustavo Alves de Campos", where: "RG (armário de metal)" },
      { q: "Data de aniversário do Gustavo", a: "07/06/1978", where: "RG (armário de metal)" },
      { q: "Data de casamento", a: "10/08/1997", where: "Pulseira de prata (freezer)" },
      { q: "Nascimento da filha", a: "02/09/2015", where: "Foto de aniversário (freezer)" },
      { q: "Nome da esposa", a: "Olívia", where: "Pulseira de prata (freezer)" },
      { q: "Nome da filha", a: "Laura", where: "Foto de aniversário (freezer)" }
    ]
  },

  gallery: [
    { group: "Handouts", items: [
      { id: "h01", file: "handouts/h01.png", title: "01 Conversa da Eloísa", note: "Celular do Alan (1% de bateria). Só o Alan vê, depois apaga." },
      { id: "h02", file: "handouts/h02.jpg", title: "02 Símbolo no teto", note: "Alcançar DT 7 subindo no altar molhado." },
      { id: "h03", file: "handouts/h03.jpg", title: "03 RG do Gustavo", note: "Jaqueta no armário de metal." },
      { id: "h04", file: "handouts/h04.jpg", title: "04 Anotações arqueológicas", note: "Armário de metal. Alan reconhece a letra (Percepção DT 8)." },
      { id: "h05a", file: "handouts/h05a.png", title: "05A Grupo \"Reunião\"", note: "Celular do Gustavo desbloqueado." },
      { id: "h05b", file: "handouts/h05b.png", title: "05B Conversa com Alan", note: "Celular do Gustavo desbloqueado." },
      { id: "h05c", file: "handouts/h05c.png", title: "05C Conversa com Victor", note: "Celular do Gustavo desbloqueado." },
      { id: "h06", file: "handouts/h06.jpg", title: "06 Estante de livros", note: "Livros certos nas prateleiras 2, 3, 4 e 5." },
      { id: "h07", file: "handouts/h07.jpg", title: "07 Pôster Lutadores de Rua", note: "Prateleira 4: Pixel a Pixel." },
      { id: "h08", file: "handouts/h08.jpg", title: "08 Pôster Unidos do Invisível", note: "Prateleira 2: O Gol Que Ninguém Viu." },
      { id: "h09", file: "handouts/h09.jpg", title: "09 Pôster Eric Tufão 3", note: "Prateleira 3: Explosivos Industriais Vol. III." },
      { id: "h10", file: "handouts/h10.jpg", title: "10 Thunderland 2008", note: "Prateleira 5: Aprenda Guitarra Sem Ter Uma Guitarra." },
      { id: "h11", file: "handouts/h11.jpg", title: "11 RG do Alan", note: "Armário de roupas, sala secreta." },
      { id: "h12a", file: "handouts/h12a.png", title: "12A E-mail do Gustavo 1", note: "Computador. 12/03: \"daqui a 4 dias\" = 16/03." },
      { id: "h12b", file: "handouts/h12b.png", title: "12B E-mail do Gustavo 2", note: "Computador." },
      { id: "h12c", file: "handouts/h12c.png", title: "12C E-mail do Gustavo 3", note: "Computador." },
      { id: "h13", file: "handouts/h13.jpg", title: "13 Cadáver do Gustavo", note: "Freezer. Disciplina DT 10, falha -1 PD." },
      { id: "h14", file: "handouts/h14.jpg", title: "14 Foto de aniversário", note: "No corpo do Gustavo. Atrás: 02/09/2022, vela de 7 anos." }
    ]},
    { group: "Mapas", items: [
      { id: "m01", file: "mapas/m01.jpg", title: "Mapa 01 O porão", note: "Início da sessão." },
      { id: "m02", file: "mapas/m02.jpg", title: "Mapa 02 Porão e sala secreta", note: "Depois de abrirem a sala secreta." },
      { id: "m03", file: "mapas/m03.jpg", title: "Mapa 03 Completo, com o duto", note: "Se usarem o duto de ventilação." }
    ]},
    { group: "Fichas (escolha pela aparência)", items: [
      { id: "f-alan", file: "fichas/alan.jpg", title: "Ficha do Alan" },
      { id: "f-victor", file: "fichas/victor.jpg", title: "Ficha do Victor" },
      { id: "f-eloisa", file: "fichas/eloisa.jpg", title: "Ficha da Eloísa" },
      { id: "f-edgar", file: "fichas/edgar.jpg", title: "Ficha do Edgar" }
    ]},
    { group: "Históricos (entregue em segredo, um pra cada)", secret: true, items: [
      { id: "s-alan", file: "historicos/alan.jpg", title: "Histórico do Alan" },
      { id: "s-victor", file: "historicos/victor.jpg", title: "Histórico do Victor" },
      { id: "s-eloisa", file: "historicos/eloisa.jpg", title: "Histórico da Eloísa" },
      { id: "s-edgar", file: "historicos/edgar.jpg", title: "Histórico do Edgar" }
    ]}
  ],

  truth: [
    "Seis pessoas de um grupo de apoio online pra doentes terminais (Alan, Gustavo, Victor, Eloísa, Edgar, Kênia) fizeram o ritual do Ídolo de Pedra no porão do Gustavo em 16/03/2022. Todos foram curados.",
    "O Ídolo é um contrato: só dois sobrevivem, os outros são sacrificados.",
    "Hoje (13/10/2022) Alan matou o Gustavo e escondeu o corpo no freezer. Convenceu a Eloísa, e os dois drogaram as bebidas.",
    "Victor, avisado, não bebeu. Acertou o Alan com a tigela ritual, se trancou no Depósito B e fez um ritual pra apagar a memória do Alan. Errou o alvo: apagou a memória de todos desde o réveillon de 2021 para 2022.",
    "Com 4 jogadores, a Kênia não veio. O nome dela aparece nos handouts; ninguém sabe onde ela está."
  ],

  traps: [
    "Arrombar o armário de metal quebra o Ídolo e embaralha as anotações (Pesquisar sobe de DT 6 pra 10).",
    "Desligar o disjuntor \"Porão\" trava a estante e a porta de saída.",
    "Sem o disjuntor \"Segredo\", a sala secreta fica no breu. A lanterna do celular do Gustavo ilumina um ponto de interesse por vez.",
    "O duto é largo só até a sala secreta. Pra cima tem 10 cm.",
    "Se a mesa travar, o livro autoriza ativar a maldição antes (energia vindo do armário, espasmos no freezer)."
  ],

  rules: [
    ["Teste", "Dado do atributo + dado da perícia, contra DT 7 (salvo indicação)."],
    ["Crítico", "Dois dados iguais com valor 6 ou mais: sucesso automático e, em investigação, informação extra."],
    ["Falha crítica", "Todos os dados em 1: falha automática e rola 1d8 na tabela abaixo."],
    ["RA e RB", "O maior e o menor valor entre os dados rolados."],
    ["Passo", "d4 < d6 < d8 < d10 < d12. No máximo 4 dados rolados e 3 somados."],
    ["Ajuda", "Gasta uma ação, precisa de pelo menos d6 na perícia. d6 ou d8 dá +1 passo; d10 ou d12 dá +2."],
    ["Investigar", "O jogador diz o dado da perícia e recebe de graça as informações com DT igual ou menor ao tamanho do dado. Depois pode Examinar (rola; sem informação nova, perde 1 PD) ou Interagir."],
    ["Recapitular", "Interpreta o resumo das pistas; Intuição DT 10 dá uma pista nova. Uma vez por cena."],
    ["Compartilhar", "Explica uma pista a outro, que testa DT 10 (Pesquisar ou Intuição, conforme sua decisão). Uma vez por cena."],
    ["0 PV ou 0 PD", "Vigor (ou Disciplina) DT 7. Cada novo dano exige outro teste com DT +3. Falhou, morre."],
    ["Combate", "Teste oposto de Luta; quem vence causa dano igual à RA (armado) ou RB (desarmado). Esquivar: Acrobacia com +d6. Vários atacantes: os outros acertam com Luta DT 7. Faca de churrasco: RA + 2."],
    ["Arrombar", "Gasta 1 PV, Atletismo contra a DT. Se passar, soma a RA até atingir a PA. Faz barulho."],
    ["Alcançar", "Seguro: duas ações seguidas com Acrobacia; falhou, dano = RB e recomeça. Arriscado: uma ação, DT +3; falhou, dano = RA."],
    ["Sustentar", "Gasta 1 PV, Atletismo; a cada rodada novo teste com um passo a menos. Na estante, passa uma pessoa por rodada; se falhar enquanto alguém passa, essa pessoa perde d4 PV."]
  ],

  critFail: [
    "Vexame: o jogador descreve a ação de forma vergonhosa",
    "Machucado: Físico um passo menor até o fim da cena",
    "Desatenção: Mente um passo menor até o fim da cena",
    "Irritação: Emoção um passo menor até o fim da cena",
    "Acidente: perde d4 PV",
    "Frustração: perde d4 PD",
    "Perda: um item que carrega estraga, é esquecido ou roubado",
    "Nenhum efeito adicional"
  ],

  ending: [
    "Escaparam: leia a narração da saída (p. 60). Pergunte a cada sobrevivente o que quer fazer da vida dali pra frente. Depois a Ordo Realitas entra em contato.",
    "Todos morreram: leia a narração do Ídolo absorvendo os corpos e se restaurando.",
    "Não leia \"O que de fato aconteceu\" (p. 62-64) pros jogadores: tem coisas do Ato II."
  ]
};
