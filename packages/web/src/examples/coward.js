// grid-duel — turns left if an enemy is ahead, otherwise fires.
function onTick(me, world) {
  if (!me.canFire) return { action: "turn", args: ["left"] };
  return { action: "fire" };
}