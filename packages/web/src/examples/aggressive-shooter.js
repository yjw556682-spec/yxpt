// grid-duel — fires at the enemy as soon as possible, otherwise moves forward.
function onTick(me, world) {
  if (me.canFire) return { action: "fire" };
  return { action: "move" };
}