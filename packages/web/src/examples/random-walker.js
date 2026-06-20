// grid-duel — 50% move, 50% turn left.
function onTick(me, world) {
  if (Math.random() < 0.5) return { action: "move" };
  return { action: "turn", args: ["left"] };
}