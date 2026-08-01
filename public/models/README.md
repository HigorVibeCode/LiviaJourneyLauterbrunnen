# Modelos (GLTF / GLB)

O formato **`.glb`** (glTF binário) é o suportado pelo jogo via
`@react-three/drei` (`useGLTF`).

## Livia

Personagem jogável = rig **procedural** low-poly (`LiviaRig.jsx`) com clips
em código (`clips.js`): `idle`, `walk`, `run`, `jump`, `fall` via
`AnimationMixer` + crossfade. Hierarquia com joelhos (`KneeR/L`) e antebraços
(`ForeR/L`) para passada mais natural. Paleta alpina (túnica vermelha, saia
roxa, laço dourado).

## Emma (não usada no jogo)

```
public/models/emma.glb
```

Arquivo de referência mantido no projeto; **não** é o personagem jogável.

## Requisitos do .glb

- Personagem em pé, olhando para **+Z**, origem entre os pés.
- A altura é normalizada para 1.72 automaticamente, então qualquer escala serve.
- Clips de animação com estes nomes (a busca é por "contém", sem diferenciar
  maiúsculas):

| Estado no jogo        | Nome esperado no clip |
| --------------------- | --------------------- |
| Parada                | `idle`                |
| Andando               | `walk`                |
| Correndo (Shift)      | `run`                 |
| Pulando               | `jump`                |
| No ar / caindo        | `fall`                |

Se `run`, `jump` ou `fall` não existirem, o jogo reaproveita `walk`/`jump`.

Fontes gratuitas compatíveis: Mixamo (exportar em glTF), Quaternius,
Kenney Character Pack, Poly Pizza.

## Fênix (fase final)

```
public/models/phoenix.glb
```

Usada em `src/components/Phoenix.jsx`: sobrevoa o mirante alpino em elipse
quando a Livia está em `z < -180`. O arquivo é um FBX convertido para GLB —
vem **rigged**, mas **sem clipes de animação**; o bater de asas / cauda é
procedural (rotação dos ossos em `useFrame`). A escala é normalizada pelos
ossos (o export FBX traz fator ~0.01 na hierarquia).

## Adventure pack (cenário)

```
public/models/adventure_pack.glb
```

[Low Poly Adventure Asset Pack](https://sketchfab.com/3d-models/low-poly-adventure-asset-pack-bda2fd1158df425fb703f53d926b1ec6)
(CC-BY-NC-4.0, ghostlyfail). Kitbash com ~60 props nomeados (árvores, flores,
rochas, barril, cerca, tenda, poço, etc.), 13 materiais texturizados e um
clipe `Take 001` (fogueira — não usado).

`src/components/world/AdventureProps.jsx` carrega o GLB uma vez, extrai nós
pelo nome, normaliza escala/orientação e instancia (ou clona) um subconjunto
na pradaria, vilarejo, vale e neve. Colisões só em props sólidos; a trilha e
a lógica do jogo ficam intactas. Densidade acompanha `QUALITY_PRESETS`.
