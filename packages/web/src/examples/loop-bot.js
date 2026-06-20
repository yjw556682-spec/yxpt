// DEMO: infinite loop — this bot loses with reason "runtime" because each tick
// exceeds the 50 ms hard timeout. Use it to verify your client surfaces the
// runtime reason correctly.
function onTick(me, world) {
  while (true) { /* spin forever */ }
  return { action: "skip" };
}