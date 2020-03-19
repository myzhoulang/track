// 重写pushState 和 replaceState
// 以便执行的时候可以触发 popstate 事件
function rewriteHistory(type: string) {
  console.log(type);
  // @ts-ignore
  const oldFn = history[type];
  return function() {
    const rv = oldFn.apply(this, arguments);
    const event = new PopStateEvent("popstate");
    window.dispatchEvent(event);
    return rv;
  };
}

history.pushState = rewriteHistory("pushState");
history.replaceState = rewriteHistory("replaceState");
