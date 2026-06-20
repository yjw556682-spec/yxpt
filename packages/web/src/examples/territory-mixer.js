// territory — expand three times then turn right (use module-level state).
let count = 0;
function onTick(me, world) {
  count++;
  if (count % 4 === 0) return { action: "turn", args: ["right"] };
  return { action: "expand" };
}