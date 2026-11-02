(function (root) {
  "use strict";

  const LOW_PD_THRESHOLD = 3;

  const LINES = {
    alan: {
      alto: [
        "Uma pontada atrás dos olhos. Por um segundo você pensa no tumor, e em quanto tempo ainda resta.",
        "Você pensa na mala pronta em casa. O Iraque, o sítio, o legado. Nada disso acontece se você não sair daqui.",
        "Seu raciocínio, sempre tão organizado, tropeça. Você tenta catalogar o que vê como faria numa escavação, e a lista se embaralha."
      ],
      baixo: [
        "A nuca lateja no ritmo do coração. Você não sabe se é a pancada ou a doença andando mais rápido.",
        "Uma vida inteira estudando os mortos dos outros, e agora é você quem pode virar só mais um achado neste porão.",
        "Você repete datas de cabeça para ter certeza de que ainda é você aí dentro. 2021. 2022. Alguma coisa não fecha."
      ],
      limite: [
        "Você já não separa o que é medo do que é sintoma. A visão embaça e as palavras somem no meio da frase.",
        "Se tudo acabar aqui, ninguém vai saber o que você descobriu. Nenhum artigo, nenhum nome numa placa. Só um porão.",
        "O pensamento lógico, a única coisa que nunca te abandonou, começa a escorregar entre os dedos."
      ],
      zero: [
        "Sua mente se fecha como uma tumba selada. Por um instante, você não lembra o próprio nome.",
        "Você se encolhe, e a única coisa que sobra é a voz do médico: menos de um ano."
      ]
    },
    victor: {
      alto: [
        "Seu estômago se contrai, o velho aviso de que o corpo está perdendo a guerra. Mas a dor de sempre não vem, só o medo dela.",
        "Um verso que você lia para os alunos volta sozinho, e você se agarra a ele para não pensar no resto.",
        "Você pensa nos alunos esperando a aula de segunda-feira. Quem vai explicar Machado para eles se você não voltar?"
      ],
      baixo: [
        "Você encontra no bolso os brincos da sua avó. Ela teria uma palavra de conforto agora. Você não tem nenhuma.",
        "Toda história que você já ensinou tinha um final. Você começa a desconfiar que esta também tem, e que ele está perto.",
        "A solidão da festa de réveillon volta inteira: um monte de gente em volta e ninguém de verdade com você."
      ],
      limite: [
        "As palavras, que sempre foram o seu abrigo, se desmancham. Você abre a boca e a frase certa não sai.",
        "Você lembra do Gustavo na festa, falando do \"último ano novo\". Pela primeira vez, entende exatamente o que ele quis dizer.",
        "O frio no estômago vira enjoo. É como ler o último capítulo de um livro sem querer virar a página."
      ],
      zero: [
        "O silêncio dentro de você é total, como uma sala de aula depois que todo mundo foi embora.",
        "Você tenta lembrar do poema. Não lembra dele. Não lembra de nenhum."
      ]
    },
    eloisa: {
      alto: [
        "Você pensa no Bruninho, que dorme com a luz do corredor acesa. Você precisa voltar para apagar essa luz.",
        "Por reflexo, você ajeita o cabelo e procura uma câmera. Ninguém está filmando. Pela primeira vez em anos, ninguém está vendo.",
        "Um gosto de ferro sobe pela garganta, como nas crises que você esconde de todo mundo. Agora não. Na frente deles, não."
      ],
      baixo: [
        "A voz da Mara volta, dizendo seu nome do jeito que só ela diz. Você se agarra a isso: os dois precisam de você em casa.",
        "O sorriso que você usa nos vídeos não encaixa mais no rosto. Você tenta, e ele treme.",
        "A contagem do ano novo ecoa: 10, 9, 8... O vídeo nunca terminou de gravar. O Bruninho estava no seu colo."
      ],
      limite: [
        "Você promete em silêncio ao Bruninho que a mamãe volta. Mas, por dentro, a sua própria voz já não acredita.",
        "Toda a vida que você mostrou ao mundo parece um cenário de papelão. A única coisa real é o abraço deles, e ele está longe demais.",
        "A tontura vem forte. Você imagina a Mara tendo que explicar ao filho por que a mamãe não voltou."
      ],
      zero: [
        "O teatro acaba. Não sobra filtro, não sobra roteiro, só uma mulher com medo no escuro.",
        "Você fecha os olhos e tenta lembrar o rosto do seu filho. Por um segundo terrível, ele não vem."
      ]
    },
    edgar: {
      alto: [
        "Você fecha os punhos. São mãos de quem carregou navio a vida inteira, e mesmo assim estão tremendo.",
        "Você pensa no apartamento em silêncio. Ninguém vai notar que você sumiu, e isso pesa mais do que deveria.",
        "Sua mãe dizia que homem que trabalha não tem tempo para ter medo. Você nunca teve tanto tempo quanto agora."
      ],
      baixo: [
        "A pergunta do cais volta: para quê? Para que continuar carregando peso, se o fim já está marcado?",
        "Você sente os músculos e pensa na doença que vai levar cada um deles. Hoje eles ainda obedecem. Por quanto tempo?",
        "O médico disse um nome comprido que você nem fez questão de guardar. Agora parece importante, e ele não vem."
      ],
      limite: [
        "Você pensa na sua mãe e, pela primeira vez, queria que alguém estivesse aqui para segurar sua mão.",
        "O corpo grande que sempre foi a sua garantia parece emprestado. Você não confia mais nele.",
        "O cansaço de uma vida inteira cai de uma vez. Seria tão fácil sentar no chão e esperar."
      ],
      zero: [
        "Você fica parado. Não por medo. Por não ver mais motivo para se mexer.",
        "O espumante barato, os fogos pela janela, a casa vazia. Foi assim que o ano começou. Talvez seja assim que ele acabe."
      ]
    }
  };

  function tierFor(pdAfter, pdMax) {
    if (pdAfter <= 0) return "zero";
    if (pdAfter <= LOW_PD_THRESHOLD) return "limite";
    if (pdAfter <= pdMax / 2) return "baixo";
    return "alto";
  }

  function pickLine(id, pdAfter, pdMax, usedCount) {
    const byChar = LINES[id];
    if (!byChar) return null;
    const tier = tierFor(pdAfter, pdMax);
    const options = byChar[tier];
    const index = (usedCount || 0) % options.length;
    return { tier, index, text: options[index] };
  }

  const api = { LINES, tierFor, pickLine };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FalasPD = api;
})(typeof window !== "undefined" ? window : globalThis);
