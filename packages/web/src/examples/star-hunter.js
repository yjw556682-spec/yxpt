// grid-duel — moves toward the star if present, otherwise turns to face the enemy and fires.
function onTick(me, world) {
  if (me.star) {
    const sx = me.star[0];
    const sy = me.star[1];
    const dx = sx - me.position[0];
    const dy = sy - me.position[1];
    if (dx > 0 && me.direction !== 1) return { action: "turn", args: ["right"] };
    if (dx < 0 && me.direction !== 3) return { action: "turn", args: ["left"] };
    if (dy > 0 && me.direction !== 2) return { action: "turn", args: ["left"] };
    if (dy < 0 && me.direction !== 0) return { action: "turn", args: ["right"] };
    return { action: "move" };
  }
  if (me.canFire) return { action: "fire" };
  return { action: "turn", args: ["left"] };
}