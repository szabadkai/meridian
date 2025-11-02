export const TurnPhases = {
  PLAYER: 'player',
  ENEMY: 'enemy'
};

export const CoverTypes = {
  NONE: 'none',
  LOW: 'low',
  HIGH: 'high'
};

export function createUnit(config) {
  return {
    id: config.id,
    name: config.name,
    team: config.team,
    class: config.class,
    hp: config.hp,
    maxHp: config.maxHp ?? config.hp,
    moveRange: config.moveRange ?? 4,
    attackRange: config.attackRange ?? 3,
    accuracy: config.accuracy ?? 70,
    damage: config.damage ?? [1, 6],
    abilities: config.abilities ?? [],
    position: { ...config.position },
    statusEffects: [],
    abilityState: {
      dashUsed: false,
      suppressUsed: false,
      repairCharges: 2
    },
    acted: false,
    downed: false
  };
}

export function isUnitAlive(unit) {
  return unit.hp > 0 && !unit.downed;
}

export function rollDamage(damageRange) {
  const [min, max] = damageRange;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function calculateCoverModifier(cover = CoverTypes.NONE) {
  if (cover === CoverTypes.LOW) {
    return -10;
  }
  if (cover === CoverTypes.HIGH) {
    return -25;
  }
  return 0;
}

export function calculateHitChance(attacker, defender, context = {}) {
  const coverMod = calculateCoverModifier(context.cover);
  const statusMod = defender.statusEffects.reduce((acc, status) => acc + (status.defenseMod ?? 0), 0);
  const abilityMod = context.modifiers ?? 0;
  const suppressedMod = defender.statusEffects.some((status) => status.id === 'suppressed') ? -15 : 0;
  const result = attacker.accuracy + coverMod + statusMod + abilityMod + suppressedMod;
  return clamp(Math.round(result), 5, 95);
}

export function resolveAttack(attacker, defender, context = {}) {
  const hitChance = calculateHitChance(attacker, defender, context);
  const roll = Math.random() * 100;
  if (roll <= hitChance) {
    const damage = rollDamage(attacker.damage);
    defender.hp = Math.max(0, defender.hp - damage);
    if (defender.hp === 0) {
      defender.downed = true;
    }
    return { hit: true, damage, hitChance };
  }
  return { hit: false, damage: 0, hitChance };
}

export function tickStatusEffects(unit) {
  unit.statusEffects = unit.statusEffects
    .map((status) => ({
      ...status,
      duration: status.duration - 1
    }))
    .filter((status) => status.duration > 0);
}

export function applyStatus(unit, status) {
  const existing = unit.statusEffects.find((s) => s.id === status.id);
  if (existing) {
    existing.duration = Math.max(existing.duration, status.duration);
    existing.defenseMod = status.defenseMod ?? existing.defenseMod;
  } else {
    unit.statusEffects.push({ ...status });
  }
}

export function resolveAbility(abilityId, user, target, context = {}) {
  const handlers = {
    dash: dashAbility,
    suppress: suppressAbility,
    repair: repairAbility
  };

  const handler = handlers[abilityId];
  if (!handler) {
    return { success: false, message: `Ability ${abilityId} not implemented.` };
  }
  return handler(user, target, context);
}

function dashAbility(user) {
  if (user.abilityState.dashUsed) {
    return { success: false, message: 'Dash already used.' };
  }
  user.abilityState.dashUsed = true;
  return {
    success: true,
    type: 'dash',
    message: `${user.name} can move again.`,
    extraMovement: user.moveRange
  };
}

function suppressAbility(user, target) {
  if (user.abilityState.suppressUsed) {
    return { success: false, message: 'Suppress already used this turn.' };
  }
  user.abilityState.suppressUsed = true;
  if (!target) {
    return { success: false, message: 'No target for suppress.' };
  }
  applyStatus(target, {
    id: 'suppressed',
    duration: 2,
    defenseMod: 0,
    description: 'Reduced accuracy next attack.'
  });
  return {
    success: true,
    type: 'suppress',
    message: `${target.name} is suppressed and loses accuracy.`,
    accuracyPenalty: -15
  };
}

function repairAbility(user, target = user) {
  if (user.abilityState.repairCharges <= 0) {
    return { success: false, message: 'No repair charges left.' };
  }
  user.abilityState.repairCharges -= 1;
  const healAmount = 2;
  target.hp = clamp(target.hp + healAmount, 0, target.maxHp);
  target.downed = target.hp === 0 ? target.downed : false;
  return {
    success: true,
    type: 'repair',
    message: `${user.name} repairs ${target.name} for ${healAmount} HP.`,
    heal: healAmount
  };
}

export function endTurn(units) {
  units.forEach((unit) => {
    unit.acted = false;
    userAbilityReset(unit);
    tickStatusEffects(unit);
  });
}

function userAbilityReset(unit) {
  if (unit.team === 'player') {
    unit.abilityState.suppressUsed = false;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
