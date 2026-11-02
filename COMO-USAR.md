# Como usar: kit do mestre de "A Maldição do Ídolo de Pedra", Ato I

Kit para mestrar o Ato I do playtest de Ordem Paranormal RPG II.
Tem um painel do mestre no navegador, uma tela para a TV com o mapa e os personagens, um celular do Gustavo que os jogadores usam no próprio celular, a folha do mestre e o material para imprimir.

## 1. Baixar

1. Na página do projeto no GitHub, clique no botão verde **Code** e depois em **Download ZIP**.
2. Extraia o ZIP numa pasta do computador. Não abra os arquivos de dentro do ZIP sem extrair.

## 2. Antes da sessão

- **Leia a folha do mestre:** `folha-do-mestre-idolo-de-pedra-ato-1.md`. O livro completo está em `fonte/`.
- **Imprima o que precisar:** `impressao/material-para-imprimir.pdf` tem as fichas dos cinco personagens, os RGs para recortar, as anotações, a foto e os cartões que os jogadores encontram. Imprima só as fichas de quem vai jogar.
- **Os históricos** de cada personagem estão no painel, na aba "Handouts e mapas". Mostre um para cada jogador, em segredo.

## 3. Abrir o painel

Há dois jeitos.

**Sem o celular dos jogadores (mais simples):** abra `painel-do-mestre/index.html` no Chrome ou no Edge.
Tudo funciona, menos o celular do Gustavo no celular dos jogadores.
Nesse caso, mostre as conversas do celular pela TV, na aba "Handouts e mapas".

**Com o celular dos jogadores (Windows):**
1. Instale o Python 3 pelo site https://www.python.org/downloads/ . Na primeira tela do instalador, marque **"Add python.exe to PATH"**.
2. Dê dois cliques em `iniciar-sessao.bat`. Abre uma janela preta, e o painel abre sozinho no navegador.
3. Se o Windows perguntar sobre o Firewall, permita o acesso em **redes privadas**. Sem isso, os celulares não conseguem entrar.
4. Deixe a janela preta aberta durante a sessão. Fechar a janela desliga o servidor.

No Mac, o arquivo é `iniciar-sessao.command`. Na primeira vez, clique com o botão direito e escolha **Abrir**.

## 4. Começar a sessão

1. **Escolha o número de jogadores** no seletor "Jogadores", no topo do painel: 3, 4 ou 5.
   - Com 3, o Edgar não é jogável: ele já está morto no altar.
   - Com 5, entra a Kênia.
   - O painel, a TV e as travas se ajustam sozinhos. O que muda na história está no começo da folha do mestre.
2. **TV:** na aba "Mapa e TV", clique em "Abrir tela dos jogadores". Arraste a janela que abriu para a TV e clique nela (ou aperte F) para ficar em tela cheia.
3. **Música:** os botões "O Porão" e "O Ídolo" ficam no topo do painel.
4. **Rodadas:** use o "+" no topo a cada rodada. Os lembretes de cada rodada aparecem sozinhos.
5. **Para zerar tudo** antes de uma nova mesa, clique em "Nova sessão".

## 5. O celular do Gustavo no celular dos jogadores

Só funciona se você abriu o painel pelo `iniciar-sessao.bat`.
1. Os celulares dos jogadores precisam estar na mesma rede Wi-Fi do computador.
2. Quando os jogadores acharem o celular do Gustavo, vá na aba "Celular" do painel e clique em **"Ligar celular"**.
3. Quem pegou o celular escaneia o QR code que aparece na aba. Antes disso, a página mostra "Celular desligado".
4. A aba "Celular" mostra em que tela o jogador está e quais perguntas de segurança ele já acertou.

## 6. Problemas comuns

- **"py" ou "python" não é reconhecido:** o Python não está instalado, ou faltou marcar "Add python.exe to PATH". Instale de novo marcando essa opção.
- **O celular não abre o link:** confira se o celular está no mesmo Wi-Fi e se o Firewall permitiu o Python em redes privadas.
- **"A porta 8765 já está em uso":** o servidor já está ligado em outra janela. Use o painel que já está aberto.
- **A TV não atualiza:** na aba "Mapa e TV", clique em "Abrir de novo".
