/**
 * Narrativa canônica — Coração do Vale e ritos de passagem.
 */

export const STORY_TITLE = 'A Jornada de Livia'

export const INTRO_LINES = [
  {
    kicker: 'Lauterbrunnen',
    title: 'A promessa da avó',
    body: 'A avó da Livia contava a lenda do Coração do Vale: um tesouro escondido no alto do Mirante, que acorda a Fênix Alpina. Quem chega até lá voa pelo céu e vê o vale inteirinho lá de cima.',
  },
  {
    kicker: 'Os portões',
    title: 'Sete reinos, cinco portões',
    body: 'O caminho passa por pradarias, pasto, um vale noturno, cachoeiras e neve. Os portões só abrem quando a Livia encontra os objetos certos — e alguns amigos pelo caminho vão ajudar.',
  },
  {
    kicker: 'Dica',
    title: 'Siga a estrela',
    body: 'A seta no alto da tela sempre aponta para o próximo objetivo. Segure G (ou o botão ✨) para a luz da guia mostrar o caminho. Boa jornada!',
  },
]

/** Capítulos emocionais por bioma (HUD) */
export const CHAPTER_STORY = {
  meadow: 'Pradaria florida — onde tudo começa.',
  pasture: 'Pasto do rancho — confie no cavalo e atravesse o dia.',
  night: 'Vale noturno — um lampião ajuda a enxergar.',
  water: 'Vale das águas — a ponte lembra quem a cuida.',
  snow: 'Passo nevado — o gelo cede ao brilho da cascata.',
  flower: 'Prado florido — respire. A escada é a última prova.',
  summit: 'Mirante alpino — o Coração do Vale aguarda.',
}

export const GATE_LORE = {
  gate_pasture: 'Chave e capa: abrir caminho e enfrentar o tempo.',
  gate_night: 'Confiança no rancho — o dia cede à noite.',
  gate_water: 'Fungo e pena: luz na escuridão e sinal das aves.',
  gate_snow: 'Ferramenta e casaco: ofício na ponte e frio das águas.',
  gate_summit: 'Cristal e binóculo: essência da cascata e olhar ao topo.',
}

export const ITEM_LORE = {
  chave_portao: 'Abre o primeiro selo — quem parte precisa de permissão.',
  capa_chuva: 'Protege quem atravessa o tempo antes do pasto.',
  fungo_brilho: 'Um pouco de luz viva para a noite engolir.',
  pena_coruja: 'Amuleto das aves — quem voa vê o caminho.',
  ferramenta: 'A ponte lembra quem a conserta.',
  casaco: 'Pele contra o frio das águas geladas.',
  cristal: 'Gotas da cascata presas no gelo eterno.',
  binoculo: 'Olhar longe antes de subir ao mirante.',
}

export const NPC_DIALOGUES = {
  npc_night_guard: {
    greet: 'Viajante… a noite só abre para quem carrega um pouco de luz.',
    give: 'Leve este fungo brilhante. Ele não apaga a escuridão — mas a desafia.',
  },
  npc_bridge_keeper: {
    greet: 'Esta ponte aguenta quem a trata com respeito.',
    give: 'Pegue a ferramenta. Madeira e água pedem mãos atentas.',
  },
  npc_snow_guide: {
    greet: 'Sem o brilho da cascata, o gelo engole os passos.',
    give: 'Este cristal guarda a essência das águas. Não o perca no frio.',
  },
}

export const UNLOCK_TOASTS = {
  gate_pasture: 'Portão aberto! Monte o cavalo e atravesse o pasto.',
  gate_water: 'A noite cede! O Vale das Águas te espera.',
  gate_snow: 'Passagem aberta! Agora, o Passo Nevado.',
  gate_summit: 'Último portão! Siga pelo Prado Florido até a escadaria.',
}

export const FINALE_TOAST = 'Livia encontrou o Coração do Vale!'
export const FINISH_TOAST = 'A promessa da avó foi cumprida.'

export const ENDING_TEXT =
  'Livia atravessou pradaria, pasto, noite, águas e neve. No mirante, o Coração do Vale despertou a Fênix Alpina — e ela viu Lauterbrunnen como a avó sempre contava. A promessa ficou no céu; o vale ficou no coração.'

export const LANTERN_TOAST = 'Lampião aceso! A luz da avó guia Livia na escuridão.'

export const SIGN_TEXTS = [
  'Pradaria → Chave e Capa',
  'Pasto → Monte o cavalo',
  'Vale Noturno → Lampião',
  'Vale das Águas → Ponte',
  'Passo Nevado → Cristal',
  'Prado Florido → Respire',
  'Mirante → Coração do Vale',
]

export const EGG_LORE = {
  egg_bell: 'Sino da avó — tocava ao entardecer na pradaria.',
  egg_hay: 'Feno do rancho — cheiro de sol antes da noite.',
  egg_firefly: 'Vaga-lumes guardam segredos no vale escuro.',
  egg_bridge: 'Salpicos da ponte — água gelada, riso quente.',
  egg_snowman: 'Boneco de neve — riso antes do frio subir.',
  egg_ring: 'Anel de flores — último respiro antes da escada.',
  egg_flag: 'Bandeira no topo — quase lá.',
}

export const LOADING_PHASES = [
  { id: 'assets', label: 'Carregando o vale…', weight: 0.45 },
  { id: 'world', label: 'Arrumando trilhas e penhascos…', weight: 0.25 },
  { id: 'shaders', label: 'Acordando a fênix…', weight: 0.2 },
  { id: 'ready', label: 'Quase pronta…', weight: 0.1 },
]
