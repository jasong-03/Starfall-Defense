// ZK Loot System - Card rarity tiers, skills, and boosts
// Rarity is derived from poseidon2(seed, wave, cardIndex) % 100

var RarityTier = {
  COMMON:    { name: 'COMMON',    color: '#aaaaaa', min: 0,  max: 49, chance: '50%' },
  RARE:      { name: 'RARE',      color: '#00ccff', min: 50, max: 79, chance: '30%' },
  EPIC:      { name: 'EPIC',      color: '#cc44ff', min: 80, max: 94, chance: '15%' },
  LEGENDARY: { name: 'LEGENDARY', color: '#ffaa00', min: 95, max: 99, chance: '5%'  },
};

// Skill definitions for each rarity tier
var SkillTable = {
  COMMON: {
    name: 'Ammo Cache',
    description: '+2 ammo',
    ammoBonus: 2,
    speedBonus: 0,     // % faster projectiles
    damageBonus: 0,    // extra score per hit
    blastRadius: false, // area damage
  },
  RARE: {
    name: 'Rapid Fire',
    description: '+3 ammo, 15% faster',
    ammoBonus: 3,
    speedBonus: 15,
    damageBonus: 0,
    blastRadius: false,
  },
  EPIC: {
    name: 'Precision Strike',
    description: '+4 ammo, 25% faster, +5 dmg',
    ammoBonus: 4,
    speedBonus: 25,
    damageBonus: 5,
    blastRadius: false,
  },
  LEGENDARY: {
    name: 'Orbital Cannon',
    description: '+6 ammo, 35% faster, +10 dmg, AoE',
    ammoBonus: 6,
    speedBonus: 35,
    damageBonus: 10,
    blastRadius: true,
  },
};

function getTierFromRarity(rarity) {
  if (rarity >= 95) return RarityTier.LEGENDARY;
  if (rarity >= 80) return RarityTier.EPIC;
  if (rarity >= 50) return RarityTier.RARE;
  return RarityTier.COMMON;
}

function getSkillFromRarity(rarity) {
  var tier = getTierFromRarity(rarity);
  return SkillTable[tier.name];
}

// Card object representing a revealed loot card
function createCard(wave, cardIndex, rarity) {
  var tier = getTierFromRarity(rarity);
  var skill = SkillTable[tier.name];
  return {
    wave: wave,
    cardIndex: cardIndex,
    rarity: rarity,
    tier: tier,
    skill: skill,
  };
}

// Accumulated boosts from all collected cards
function computeBoosts(cards) {
  var boosts = {
    totalAmmo: 0,
    speedPercent: 0,
    damageBonus: 0,
    hasBlastRadius: false,
  };
  for (var i = 0; i < cards.length; i++) {
    var skill = cards[i].skill;
    boosts.totalAmmo += skill.ammoBonus;
    boosts.speedPercent += skill.speedBonus;
    boosts.damageBonus += skill.damageBonus;
    if (skill.blastRadius) boosts.hasBlastRadius = true;
  }
  return boosts;
}

window.LootSystem = {
  RarityTier: RarityTier,
  SkillTable: SkillTable,
  getTierFromRarity: getTierFromRarity,
  getSkillFromRarity: getSkillFromRarity,
  createCard: createCard,
  computeBoosts: computeBoosts,
};
