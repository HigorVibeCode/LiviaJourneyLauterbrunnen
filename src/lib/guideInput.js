/**
 * Estado mutável do E: tap curto = interagir (portão); segurar = guia (SotC).
 * Livia atualiza; Gate consome `tapPending` no release curto.
 */

/** Segurar E por este tempo acende a guia (e cancela o tap de interação) */
export const GUIDE_HOLD_SEC = 0.28

/** Tempo total de uso do feixe por ativação (recarrega lentamente) */
export const GUIDE_MAX_CHARGE = 12

/** Velocidade de recarga quando o feixe não está em uso */
export const GUIDE_RECHARGE_RATE = 0.35

export const guideInput = {
  /** E está pressionado */
  holding: false,
  /** Segurou além do limiar — feixe ativo */
  guiding: false,
  /** Segundos com E pressionado neste pressionamento */
  holdTime: 0,
  /** Release curto sem ter entrado em guiding → Gate deve interagir */
  tapPending: false,
  /** Marca tap não consumido para limpar no frame seguinte */
  tapStale: false,
  /** Carga restante do feixe (segundos) */
  charge: GUIDE_MAX_CHARGE,
  /** Carga esgotada — não dá mais para usar o feixe */
  depleted: false,
}

/** Osso da mão apontando (registrado por LiviaModel / LiviaRig) */
export const guideHand = {
  bone: null,
  /** espelho de guideInput.guiding para o feixe na cena */
  active: false,
}
