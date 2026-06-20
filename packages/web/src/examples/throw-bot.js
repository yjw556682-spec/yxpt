// DEMO: throws on every tick — this bot loses with reason "error". Use it to
// verify your client surfaces the error reason correctly.
function onTick(me, world) {
  throw new Error("oops");
}