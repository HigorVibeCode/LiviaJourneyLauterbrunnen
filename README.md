# A Jornada de Livia

Uma aventura 3D pelo vale de Lauterbrunnen, nos Alpes suíços. A Livia
atravessa sete regiões (pradaria, pasto, vale noturno, vale das águas,
passo nevado, prado florido e mirante) para encontrar o Coração do Vale
e voar com a Fênix Alpina.

Feito com React Three Fiber, Rapier (física) e zustand. Todo o som e a
música são gerados no navegador, sem arquivos de áudio.

## Como jogar

| Ação | Teclado | Toque |
| --- | --- | --- |
| Andar | W A S D / setas | joystick (empurre até o fim para correr) |
| Correr | Shift | joystick no máximo |
| Pular | Espaço | botão **Pular** |
| Abrir portão / falar / montar | E | botão de ação (mostra "Abrir", "Falar", "Montar") |
| Guia luminosa | segurar G (ou segurar E) | botão ✨ |
| Olhar em volta | mouse (clique no jogo) | arrastar o dedo na tela |
| Pausa | Esc ou P | botão ⏸ |

- A **seta no alto da tela** sempre aponta o próximo objetivo.
- Há **125 estrelinhas** pela trilha e **7 segredos** escondidos.
- O progresso é **salvo automaticamente**. A tela de título oferece
  "Continuar" ou "Novo jogo", e o menu de pausa tem "voltar para a trilha"
  (se ela ficar presa) e "recomeçar do início".
- A qualidade gráfica é escolhida sozinha (tablets e celulares começam em
  "Baixa") e cai automaticamente se o jogo ficar lento. Dá para trocar no
  menu de pausa.

## Rodar no computador

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # gera dist/
npm run lint
```

Atalhos de qualidade pela URL: `?q=low`, `?q=medium` ou `?q=high`.

### Multijogador (opcional)

Usa PartyKit. Em desenvolvimento rode `npm run party:dev` junto com o
`npm run dev`. Em produção, faça o deploy (`npm run party:deploy`) e
defina `VITE_PARTYKIT_HOST` (veja `.env.example`). Sem essa variável o
botão "Jogar com amigos" não aparece.

## Estrutura

- `src/config/` — mapa (`world.js`), história e textos (`story.js`),
  NPCs, segredos e estrelinhas.
- `src/store/` — progresso (salvo no `localStorage`), jogador, qualidade.
- `src/components/` — mundo 3D, Livia (controle + câmera), HUD e telas.
- `src/components/world/` — terreno, vegetação, casas, estruturas.
  `StaticBatch` junta peças estáticas em poucos objetos.
- `src/components/DistanceCuller.jsx` e `LightPool.jsx` — mantêm o jogo
  leve: só desenha o que está perto e usa poucas luzes reais.
- `src/audio/` — efeitos, ambiente e música procedural.
- `public/models/` — modelos `.glb` (cenário e fênix).

## Depuração

Em `npm run dev` (ou com `?debug=1` na URL) existe `window.livia` no
console: `teleport(x, y, z)`, `pos()`, `grant(itemId)`, `unlock(gateId)`,
`state()`, `itemPos(itemId)`.
